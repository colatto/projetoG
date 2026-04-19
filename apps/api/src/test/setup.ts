// Workaround for a Vitest/tinypool shutdown issue observed in this repo:
// after tests complete, tinypool may emit an unhandledRejection with
// RangeError: Maximum call stack size exceeded.
//
// We swallow only this specific error signature to keep test results meaningful.
process.on('unhandledRejection', (reason) => {
  const err = reason as { name?: string; message?: string } | undefined;
  if (err?.name === 'RangeError' && err?.message?.includes('Maximum call stack size exceeded')) {
    return;
  }
});
