#!/usr/bin/env node
import React from 'react'
import { render } from 'ink'
import { App } from './App.js'

render(<App />, { kittyKeyboard: { mode: 'auto' } })
