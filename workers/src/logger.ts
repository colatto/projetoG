type LogLevel = 'info' | 'warn' | 'error';

let installed = false;

function serializeArg(arg: unknown): unknown {
  if (arg instanceof Error) {
    return {
      name: arg.name,
      message: arg.message,
      stack: arg.stack,
    };
  }

  if (typeof arg === 'object' && arg !== null) {
    return arg;
  }

  return String(arg);
}

function write(level: LogLevel, args: unknown[]) {
  const entry = {
    level,
    service: 'workers',
    timestamp: new Date().toISOString(),
    message: typeof args[0] === 'string' ? String(args[0]) : args.length > 0 ? 'worker-log' : '',
    context: args.slice(typeof args[0] === 'string' ? 1 : 0).map(serializeArg),
  };

  const line = JSON.stringify(entry);
  if (level === 'error') {
    process.stderr.write(`${line}\n`);
    return;
  }

  process.stdout.write(`${line}\n`);
}

export function installConsoleJsonLogger() {
  if (installed) {
    return;
  }

  installed = true;
  console.log = (...args: unknown[]) => write('info', args);
  console.warn = (...args: unknown[]) => write('warn', args);
  console.error = (...args: unknown[]) => write('error', args);
}
