"""Cliente de la API REST de Azure DevOps (portado de azureDevOpsService.js).

Cubre la ruta de lectura/sincronización: proyectos, iteraciones y work items.
Incluye creación de work items con reintentos y resolución de campos requeridos.
"""
import base64
import re
from datetime import datetime
from urllib.parse import quote, urlencode

import httpx

WORK_ITEM_FIELDS = [
    "System.Id",
    "System.Title",
    "System.State",
    "System.AssignedTo",
    "System.WorkItemType",
    "Microsoft.VSTS.Scheduling.StartDate",
    "System.IterationPath",
    "System.AreaPath",
    "System.Tags",
    "Microsoft.VSTS.Scheduling.OriginalEstimate",
    "Microsoft.VSTS.Scheduling.CompletedWork",
    "Microsoft.VSTS.Scheduling.RemainingWork",
]


def _parse_fecha(valor) -> datetime | None:
    if not valor:
        return None
    try:
        return datetime.fromisoformat(str(valor).replace("Z", "+00:00"))
    except ValueError:
        return None


class AzureDevOpsService:
    """Cliente autenticado con Personal Access Token (PAT)."""

    API_VERSION = "7.1"

    def __init__(self, org_url: str, pat: str) -> None:
        self.org_url = (org_url or "").rstrip("/")
        self.pat = pat or ""
        token = base64.b64encode(f":{self.pat}".encode()).decode()
        self.headers = {
            "Authorization": f"Basic {token}",
            "Content-Type": "application/json",
        }
        self._wit_type_cache: dict[str, dict[str, str]] = {}
        self._field_map_cache: dict[str, dict[str, dict]] = {}
        # Campos extra aprendidos de reintentos previos (proyecto+tipo → campos).
        self._learned_fields: dict[str, dict[str, object]] = {}

    def _url(self, path: str, query: dict | None = None) -> str:
        params = {"api-version": self.API_VERSION, **(query or {})}
        return f"{self.org_url}{path}?{urlencode(params)}"

    async def _fetch(
        self, cliente: httpx.AsyncClient, url: str, metodo: str = "GET", cuerpo: dict | list | None = None
    ) -> dict:
        resp = await cliente.request(metodo, url, headers=self.headers, json=cuerpo)
        if resp.status_code >= 400:
            detalle = resp.text
            try:
                parsed = resp.json()
                detalle = parsed.get("message") or parsed.get("Message") or detalle
            except ValueError:
                pass
            raise RuntimeError(f"Azure DevOps API {resp.status_code}: {detalle}")
        return resp.json()

    async def test_conexion(self) -> dict:
        async with httpx.AsyncClient(timeout=30) as cliente:
            try:
                data = await self._fetch(cliente, self._url("/_apis/projects"))
                return {"ok": True, "proyectos": data.get("count", 0)}
            except (RuntimeError, httpx.HTTPError) as exc:
                return {"ok": False, "error": str(exc)}

    async def obtener_proyectos(self) -> list[dict]:
        async with httpx.AsyncClient(timeout=30) as cliente:
            data = await self._fetch(cliente, self._url("/_apis/projects"))
        proyectos = [
            {"id": p["id"], "nombre": p["name"], "estado": p.get("state")}
            for p in data.get("value", [])
        ]
        return sorted(proyectos, key=lambda p: p["nombre"])

    async def obtener_iteraciones(self, proyecto: str) -> list[dict]:
        url = self._url(
            f"/{quote(proyecto)}/_apis/wit/classificationnodes/iterations",
            {"$depth": "10"},
        )
        async with httpx.AsyncClient(timeout=30) as cliente:
            data = await self._fetch(cliente, url)

        resultados: list[dict] = []

        def recorrer(nodo: dict, padre: str) -> None:
            path = f"{padre}\\{nodo['name']}" if padre else nodo["name"]
            resultados.append({"nombre": nodo["name"], "path": path})
            for hijo in nodo.get("children", []):
                recorrer(hijo, path)

        recorrer(data, "")
        return resultados

    def construir_wiql(self, iteration_path: str, asignado_a: str | None = None) -> str:
        condiciones = [
            f"[System.IterationPath] = '{iteration_path}'",
            "[System.WorkItemType] IN ('Task', 'Bug', 'User Story')",
        ]
        if asignado_a:
            condiciones.append(f"[System.AssignedTo] = '{asignado_a}'")
        return (
            "SELECT [System.Id] FROM workitems "
            f"WHERE {' AND '.join(condiciones)} ORDER BY [System.Id]"
        )

    async def obtener_work_items_sprint(
        self, proyecto: str, iteration_path: str, asignado_a: str | None = None
    ) -> list[dict]:
        wiql = self.construir_wiql(iteration_path, asignado_a)
        async with httpx.AsyncClient(timeout=60) as cliente:
            data = await self._fetch(
                cliente,
                self._url(f"/{quote(proyecto)}/_apis/wit/wiql"),
                "POST",
                {"query": wiql},
            )
            ids = [wi["id"] for wi in data.get("workItems", [])]
            if not ids:
                return []
            crudos: list[dict] = []
            for i in range(0, len(ids), 200):
                lote = await self._fetch(
                    cliente,
                    self._url("/_apis/wit/workitemsbatch"),
                    "POST",
                    {"ids": ids[i : i + 200], "fields": WORK_ITEM_FIELDS},
                )
                crudos.extend(lote.get("value", []))
        return [self._normalizar(wi) for wi in crudos]

    def _normalizar(self, wi: dict) -> dict:
        f = wi.get("fields", {})
        return {
            "azdo_id": int(f.get("System.Id") or wi.get("id") or 0),
            "tipo": f.get("System.WorkItemType", "Task"),
            "titulo": f.get("System.Title", "(sin título)"),
            "estado": f.get("System.State", "New"),
            "asignado_a": self._email(f.get("System.AssignedTo")),
            "original_estimate": f.get("Microsoft.VSTS.Scheduling.OriginalEstimate", 0) or 0,
            "completed_work": f.get("Microsoft.VSTS.Scheduling.CompletedWork", 0) or 0,
            "remaining_work": f.get("Microsoft.VSTS.Scheduling.RemainingWork", 0) or 0,
            "fecha_inicio": _parse_fecha(f.get("Microsoft.VSTS.Scheduling.StartDate")),
            "iteration_path": f.get("System.IterationPath", ""),
            "area_path": f.get("System.AreaPath", ""),
            "tags": f.get("System.Tags", ""),
            "url": wi.get("url", ""),
        }

    @staticmethod
    def _email(asignado_a) -> str | None:
        if not asignado_a:
            return None
        if isinstance(asignado_a, str):
            return asignado_a
        return asignado_a.get("uniqueName") or asignado_a.get("displayName")

    # ── Resolución de tipos de work item (soporta nombres localizados) ──

    async def obtener_tipos_work_item(self, proyecto: str) -> dict[str, str]:
        """Devuelve un mapa lógico → nombre real del tipo en el proceso.

        Ejemplo: ``{"userStory": "User Story", "task": "Task", "feature": "Feature"}``
        """
        if proyecto in self._wit_type_cache:
            return self._wit_type_cache[proyecto]

        async with httpx.AsyncClient(timeout=30) as cliente:
            data = await self._fetch(
                cliente,
                self._url(f"/{quote(proyecto)}/_apis/wit/workitemtypes"),
            )
        tipos = [t["name"] for t in data.get("value", [])]

        def resolver(candidatos: list[str]) -> str:
            for c in candidatos:
                for t in tipos:
                    if t.lower() == c.lower():
                        return t
            return candidatos[0]

        mapa = {
            "userStory": resolver(["User Story", "Historia de usuario", "Historia de Usuario", "Product Backlog Item"]),
            "task": resolver(["Task", "Tarea"]),
            "feature": resolver(["Feature", "Característica"]),
            "bug": resolver(["Bug", "Error"]),
        }
        self._wit_type_cache[proyecto] = mapa
        return mapa

    # ── Lectura/búsqueda/creación de work items individuales ──

    async def obtener_work_item(self, work_item_id: int) -> dict | None:
        """Lee una work item por su ID (con relaciones expandidas)."""
        url = self._url(
            f"/_apis/wit/workitems/{work_item_id}", {"$expand": "relations"}
        )
        async with httpx.AsyncClient(timeout=30) as cliente:
            try:
                return await self._fetch(cliente, url)
            except RuntimeError as exc:
                if "404" in str(exc):
                    return None
                raise

    async def buscar_work_item_por_titulo(
        self, proyecto: str, titulo: str, tipo: str
    ) -> dict | None:
        """Busca una work item por título exacto y tipo. Devuelve la primera coincidencia o None."""
        escaped = titulo.replace("'", "''")
        wiql = (
            f"SELECT [System.Id] FROM workitems "
            f"WHERE [System.TeamProject] = '{proyecto}' "
            f"AND [System.WorkItemType] = '{tipo}' "
            f"AND [System.Title] = '{escaped}' "
            f"ORDER BY [System.Id] DESC"
        )
        async with httpx.AsyncClient(timeout=30) as cliente:
            data = await self._fetch(
                cliente,
                self._url(f"/{quote(proyecto)}/_apis/wit/wiql"),
                "POST",
                {"query": wiql},
            )
        ids = [wi["id"] for wi in data.get("workItems", [])]
        if not ids:
            return None
        return await self.obtener_work_item(ids[0])

    # ── Campo permitidos (para reintentos) ──

    async def _obtener_field_map(self, proyecto: str) -> dict[str, dict]:
        """Mapa nombre_display (lower) → {referenceName, type}."""
        if proyecto in self._field_map_cache:
            return self._field_map_cache[proyecto]
        async with httpx.AsyncClient(timeout=30) as cliente:
            try:
                data = await self._fetch(cliente, self._url("/_apis/wit/fields"))
            except RuntimeError:
                data = await self._fetch(
                    cliente,
                    self._url(f"/{quote(proyecto)}/_apis/wit/fields"),
                )
        mapa = {}
        for f in data.get("value", []):
            mapa[f["name"].lower()] = {
                "referenceName": f["referenceName"],
                "type": f.get("type", "string"),
            }
        self._field_map_cache[proyecto] = mapa
        return mapa

    async def _obtener_valores_permitidos(
        self,
        cliente: httpx.AsyncClient,
        proyecto: str,
        tipo: str,
        field_ref: str,
    ) -> list:
        """Consulta los valores permitidos de un campo para un tipo de WI."""
        try:
            data = await self._fetch(
                cliente,
                self._url(
                    f"/{quote(proyecto)}/_apis/wit/workitemtypes/{quote(tipo)}/fields/{quote(field_ref)}",
                    {"$expand": "allowedValues"},
                ),
            )
            vals = data.get("allowedValues", [])
            if vals:
                return vals
        except RuntimeError:
            pass
        try:
            data = await self._fetch(
                cliente,
                self._url(
                    f"/_apis/wit/fields/{quote(field_ref)}",
                    {"$expand": "allowedValues"},
                ),
            )
            return data.get("allowedValues", [])
        except RuntimeError:
            return []

    @staticmethod
    def _parse_campos_faltantes(error_body: str) -> list[str]:
        """Extrae nombres de campos faltantes del cuerpo de error."""
        return re.findall(
            r"Rule Error for field ([^.]+)\.\s*Error code:\s*Required",
            error_body,
            re.IGNORECASE,
        )

    @staticmethod
    def _parse_campos_invalidos(error_body: str) -> list[str]:
        """Extrae nombres de campos con valores inválidos del error."""
        nombres: list[str] = []
        for m in re.finditer(
            r"The field ['\u2018\u201C\"']([^'\u2019\u201D\"']+)['\u2019\u201D\"']"
            r" contains the value .+? that is not in the list of supported values",
            error_body,
            re.IGNORECASE,
        ):
            nombres.append(m.group(1).strip())
        return nombres

    async def crear_work_item(
        self,
        proyecto: str,
        tipo: str,
        campos: dict,
        parent_id: int | None = None,
        *,
        _retry: int = 0,
        _blocked: set | None = None,
    ) -> dict:
        """Crea una work item con reintentos automáticos para campos requeridos/inválidos."""
        if _blocked is None:
            _blocked = set()

        # Aplicar campos aprendidos de reintentos previos (evita 400 repetidos)
        cache_key = f"{proyecto}|{tipo}"
        if _retry == 0 and cache_key in self._learned_fields:
            today_val = datetime.utcnow().isoformat() + "Z"
            title_val = campos.get("System.Title", "N/A")
            for ref, val in self._learned_fields[cache_key].items():
                if ref not in campos and ref not in _blocked:
                    if val == "__TODAY__":
                        campos[ref] = today_val
                    elif val == "__HTML_TITLE__":
                        campos[ref] = f"<div>{title_val}</div>"
                    elif val == "__TITLE__":
                        campos[ref] = title_val
                    else:
                        campos[ref] = val

        # Quitar campos bloqueados
        for ref in _blocked:
            campos.pop(ref, None)

        cuerpo = [
            {"op": "add", "path": f"/fields/{ref}", "value": valor}
            for ref, valor in campos.items()
            if valor is not None
        ]
        if parent_id:
            cuerpo.append(
                {
                    "op": "add",
                    "path": "/relations/-",
                    "value": {
                        "rel": "System.LinkTypes.Hierarchy-Reverse",
                        "url": f"{self.org_url}/_apis/wit/workItems/{parent_id}",
                    },
                }
            )
        url = self._url(f"/{quote(proyecto)}/_apis/wit/workitems/${quote(tipo)}")
        headers = {**self.headers, "Content-Type": "application/json-patch+json"}

        async with httpx.AsyncClient(timeout=60) as cliente:
            resp = await cliente.post(url, headers=headers, json=cuerpo)

            if resp.status_code < 400:
                return resp.json()

            error_body = resp.text

            # Reintentar en 400 hasta 5 veces
            if resp.status_code == 400 and _retry < 5:
                field_map = await self._obtener_field_map(proyecto)
                today = datetime.utcnow().isoformat() + "Z"
                changed = False
                nuevos_aprendidos: dict[str, object] = {}

                # 1) Campos con valores inválidos → usar primer valor permitido
                for nombre in self._parse_campos_invalidos(error_body):
                    info = field_map.get(nombre.lower())
                    if not info:
                        continue
                    ref = info["referenceName"]
                    allowed = await self._obtener_valores_permitidos(cliente, proyecto, tipo, ref)
                    if allowed:
                        campos[ref] = allowed[0]
                        nuevos_aprendidos[ref] = allowed[0]
                        changed = True
                    else:
                        campos.pop(ref, None)
                        _blocked.add(ref)
                        changed = True

                # 2) Campos requeridos faltantes → auto-rellenar
                for nombre in self._parse_campos_faltantes(error_body):
                    info = field_map.get(nombre.lower())
                    if not info:
                        continue
                    ref = info["referenceName"]
                    if ref in _blocked:
                        allowed = await self._obtener_valores_permitidos(cliente, proyecto, tipo, ref)
                        if allowed:
                            _blocked.discard(ref)
                            campos[ref] = allowed[0]
                            nuevos_aprendidos[ref] = allowed[0]
                            changed = True
                        continue
                    if campos.get(ref) not in (None, "", 0):
                        continue
                    allowed = await self._obtener_valores_permitidos(cliente, proyecto, tipo, ref)
                    if allowed:
                        campos[ref] = allowed[0]
                        nuevos_aprendidos[ref] = allowed[0]
                        changed = True
                        continue
                    t = info.get("type", "string")
                    fallback = campos.get("System.Title", "N/A")
                    if t == "dateTime":
                        campos[ref] = today
                        nuevos_aprendidos[ref] = "__TODAY__"
                    elif t in ("double", "integer"):
                        campos[ref] = 0
                        nuevos_aprendidos[ref] = 0
                    elif t == "html":
                        campos[ref] = f"<div>{fallback}</div>"
                        nuevos_aprendidos[ref] = "__HTML_TITLE__"
                    else:
                        campos[ref] = fallback
                        nuevos_aprendidos[ref] = "__TITLE__"
                    changed = True

                # Guardar campos aprendidos para reutilizar en siguientes creaciones
                if nuevos_aprendidos:
                    if cache_key not in self._learned_fields:
                        self._learned_fields[cache_key] = {}
                    self._learned_fields[cache_key].update(nuevos_aprendidos)

                if changed:
                    return await self.crear_work_item(
                        proyecto, tipo, campos, parent_id,
                        _retry=_retry + 1, _blocked=_blocked,
                    )

            # Error definitivo
            detalle = error_body
            try:
                parsed = resp.json()
                detalle = parsed.get("message") or parsed.get("Message") or detalle
            except ValueError:
                pass
            raise RuntimeError(
                f"Azure DevOps API {resp.status_code} al crear work item: {detalle}"
            )
