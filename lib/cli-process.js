'use strict';

const { spawn } = require('node:child_process');

function spawnCli(command, args, options = {}, platform = process.platform) {
  const isWindowsScript = platform === 'win32' && /\.(cmd|bat)$/i.test(command);
  if (!isWindowsScript) return spawn(command, args, options);

  // npm global executables on Windows are .cmd shims. Node cannot execute
  // those directly, so run the trusted local shim through cmd.exe.
  const quotedCommand = `"${command.replace(/"/g, '""')}"`;
  return spawn(quotedCommand, args, { ...options, shell: true });
}

module.exports = { spawnCli };
