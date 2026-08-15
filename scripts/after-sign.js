const { execFileSync } = require('node:child_process');
const path = require('node:path');

exports.default = async function afterSign(context) {
  if (context.electronPlatformName !== 'darwin') return;

  const appPath = path.join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.app`,
  );

  // Open-source builds do not have access to a Developer ID certificate.
  // Re-sign the complete bundle ad hoc so Gatekeeper sees a structurally valid
  // signature instead of Electron's partial linker signatures.
  execFileSync('codesign', [
    '--force',
    '--deep',
    '--sign',
    '-',
    '--timestamp=none',
    appPath,
  ], { stdio: 'inherit' });

  execFileSync('codesign', [
    '--verify',
    '--deep',
    '--strict',
    '--verbose=2',
    appPath,
  ], { stdio: 'inherit' });
};
