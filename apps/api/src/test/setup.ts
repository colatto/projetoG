/** PRD-04 follow-up business-day math uses local calendar; CI defaults to UTC without this. */
process.env.TZ = 'America/Sao_Paulo';

const unhandledRejectionHandlerInstalledKey = '__apiVitestUnhandledRejectionHandlerInstalled__';

function isKnownTinypoolShutdownRangeError(
  reason: unknown,
): reason is { name?: string; message?: string; stack?: string } {
  if (!reason || typeof reason !== 'object') {
    return false;
  }

  const err = reason as { name?: string; message?: string; stack?: string };
  return (
    err.name === 'RangeError' && err.message?.includes('Maximum call stack size exceeded') === true
  );
}

if (!(globalThis as Record<string, unknown>)[unhandledRejectionHandlerInstalledKey]) {
  process.on('unhandledRejection', (reason) => {
    if (isKnownTinypoolShutdownRangeError(reason)) {
      return;
    }

    throw reason instanceof Error ? reason : new Error(`Unhandled rejection: ${String(reason)}`);
  });

  (globalThis as Record<string, unknown>)[unhandledRejectionHandlerInstalledKey] = true;
}
