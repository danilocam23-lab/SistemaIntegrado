param(
    [Parameter(Mandatory)][string]$Plantilla,
    [Parameter(Mandatory)][string]$Destino,
    [Parameter(Mandatory)][string]$PublishDir,
    [Parameter(Mandatory)][string]$AppName
)
# Genera web.config desde la plantilla: reemplaza rutas y APP_ROOT_PATH,
# valida que sea XML bien formado y lo escribe en UTF-8 sin BOM.
$ErrorActionPreference = 'Stop'
$texto = [IO.File]::ReadAllText($Plantilla, [Text.Encoding]::UTF8)
$texto = $texto.Replace('__PUBLISH_DIR__', $PublishDir)
$texto = $texto.Replace('value="/SistemaIntegrado"', 'value="/' + $AppName + '"')

try { [void][xml]$texto } catch {
    Write-Error "El web.config generado no es XML valido: $($_.Exception.Message)"
    exit 1
}

[IO.File]::WriteAllText($Destino, $texto, (New-Object Text.UTF8Encoding($false)))
Write-Host "        web.config escrito en $Destino"
