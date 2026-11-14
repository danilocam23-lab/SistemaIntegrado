// Copyright (c) 2026 Jose Danilo Camacho A. / Tecno-Insights S.A.S.
// SPDX-License-Identifier: MIT

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import PreferenciasAnalitica from './components/PreferenciasAnalitica'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PreferenciasAnalitica />
    <App />
  </React.StrictMode>,
)
