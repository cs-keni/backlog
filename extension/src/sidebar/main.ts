import { injectSidebar } from './inject'
import { extractPageInfo } from '../content/detect'

injectSidebar(extractPageInfo())
