import pino from 'pino'

// In development we route through pino-pretty for colorized, human-readable lines.
// In production we emit newline-delimited JSON straight to stdout, which is what log aggregators expect.
const isDev = process.env.NODE_ENV === 'development'

const rootLogger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  ...(isDev
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            // `component` is rendered inside messageFormat below, so drop it (and the noisy process
            // fields) from the trailing key/value list.
            ignore: 'pid,hostname,component',
            messageFormat: '[{component}] {msg}',
            translateTime: 'SYS:HH:MM:ss.l',
          },
        },
      }
    : {}),
}) as pino.Logger

// Each module gets a child logger bound to its component name, which replaces the hand-written
// `[Component]` string prefixes that used to live in every log call.
export function createLogger(component: string) {
  return rootLogger.child({ component })
}
