import fs from "fs/promises"
import path from "path"
import { execa } from "execa"
import { resolvePlaceholders } from "./placeholder-resolver"
import { copyDir, copyFile, pathExists } from "./source-resolver"
import { processIni } from "./ini-generator"
import type { BuildLogger } from "./build-logger"
import type {
  PackageDefinition,
  ArchiveDefinition,
  DirectoryNode,
  InstallSection,
} from "@/types/package-schema"

/**
 * Process a DirectoryNode recursively into destDir.
 * Order of processing within the destination:
 *   1. Copy base source directory (if name is defined)
 *   2. wdlls
 *   3. dlls
 *   4. files
 *   5. inis
 *   6. child directories (recursive)
 */
async function processDirectoryNode(
  node: DirectoryNode,
  version: string,
  srcDir: string,
  destDir: string,
  logger: BuildLogger,
  installMode = false // when true, srcDir base is SRC_DIR/install/
): Promise<void> {
  const resolvedName = node.name
    ? resolvePlaceholders(node.name, version)
    : undefined

  // Determine target directory
  let target: string
  if (node.onlyContent === true || !resolvedName) {
    target = destDir
  } else {
    // Normalize Windows separators that may exist in JSON names like "3.3.3\\Medoc"
    target = path.join(destDir, ...path.normalize(resolvedName).split(path.sep))
    await fs.mkdir(target, { recursive: true })
  }

  // C. Copy base source directory (only if name is defined)
  if (resolvedName) {
    const baseDir = installMode
      ? path.join(
          srcDir,
          "directories",
          ...path.normalize(resolvedName).split(path.sep)
        )
      : path.join(
          srcDir,
          "directories",
          ...path.normalize(resolvedName).split(path.sep)
        )
    if (await pathExists(baseDir)) {
      try {
        await copyDir(baseDir, target)
      } catch (err) {
        logger.warn(`Could not copy base directory "${baseDir}": ${err}`)
      }
    } else {
      logger.warn(`Source directory not found: ${baseDir}`)
    }
  }

  // D. wdlls
  if (node.wdlls) {
    for (const w of node.wdlls) {
      const wdllsSrc = installMode
        ? path.join(srcDir, "wdlls", String(w.version))
        : path.join(srcDir, "wdlls", String(w.version))
      if (await pathExists(wdllsSrc)) {
        try {
          await copyDir(wdllsSrc, target)
        } catch (err) {
          logger.warn(`Could not copy wdlls/${w.version}: ${err}`)
        }
      } else {
        logger.warn(`wdlls source not found: ${wdllsSrc}`)
      }
    }
  }

  // E. dlls
  if (node.dlls) {
    for (const d of node.dlls) {
      const resolvedDllName = resolvePlaceholders(d.name, version)
      const dllsSrc = path.join(srcDir, "dlls", resolvedDllName)
      if (await pathExists(dllsSrc)) {
        try {
          await copyDir(dllsSrc, target)
        } catch (err) {
          logger.warn(`Could not copy dlls/${resolvedDllName}: ${err}`)
        }
      } else {
        logger.warn(`dlls source not found: ${dllsSrc}`)
      }
    }
  }

  // F. files
  if (node.files) {
    for (const filePath of node.files) {
      const resolvedFilePath = resolvePlaceholders(filePath, version)
      const filesDir = installMode
        ? path.join(srcDir, "files")
        : path.join(srcDir, "files")
      const srcFile = path.join(
        filesDir,
        ...path.normalize(resolvedFilePath).split(path.sep)
      )
      const fileName = path.basename(resolvedFilePath)
      const destFile = path.join(target, fileName)
      if (await pathExists(srcFile)) {
        try {
          await copyFile(srcFile, destFile)
        } catch (err) {
          logger.warn(`Could not copy file "${resolvedFilePath}": ${err}`)
        }
      } else {
        logger.warn(`File source not found: ${srcFile}`)
      }
    }
  }

  // G. inis
  if (node.inis) {
    for (const iniDef of node.inis) {
      const destIniPath = path.join(target, iniDef.name)
      try {
        // For install mode, use srcDir directly as the base (SRC_DIR/install/...)
        // The processIni always reads from SRC_DIR/files/inis/ - we pass the actual SRC_DIR here
        // When in install mode, srcDir is already SRC_DIR/install/, but inis come from SRC_DIR/files/inis/
        // So we need to pass the real srcDir. We'll handle this by keeping a reference to the real srcDir.
        await processIni(iniDef, version, srcDir, destIniPath)
      } catch (err) {
        logger.warn(`Could not process ini "${iniDef.name}": ${err}`)
      }
    }
  }

  // H. child directories (recursive)
  if (node.directories) {
    for (const child of node.directories) {
      await processDirectoryNode(
        child,
        version,
        srcDir,
        target,
        logger,
        installMode
      )
    }
  }
}

/**
 * Build a single archive recursively.
 * Nested archives are built first and placed in the parent staging dir.
 */
async function buildArchive(
  archiveDef: ArchiveDefinition,
  version: string,
  srcDir: string,
  tempDir: string,
  logger: BuildLogger,
  keepTemp = false
): Promise<void> {
  logger.log(`Building archive: ${archiveDef.name}.${archiveDef.extension}`)

  const stagingDir = path.join(tempDir, archiveDef.name)
  await fs.mkdir(stagingDir, { recursive: true })

  // 1. Build nested archives first (their .7z goes into stagingDir)
  if (archiveDef.archives && archiveDef.archives.length > 0) {
    for (const nested of archiveDef.archives) {
      await buildArchive(nested, version, srcDir, stagingDir, logger, keepTemp)
    }
  }

  // 2. Process the archive's own content (treat archiveDef as a DirectoryNode)
  const node: DirectoryNode = {
    wdlls: archiveDef.wdlls,
    dlls: archiveDef.dlls,
    directories: archiveDef.directories,
    files: archiveDef.files,
    inis: archiveDef.inis,
  }
  await processDirectoryNode(node, version, srcDir, stagingDir, logger)

  // 3. Create the .7z archive
  const archivePath = path.join(
    tempDir,
    `${archiveDef.name}.${archiveDef.extension}`
  )
  logger.log(`Compressing: ${archiveDef.name}.${archiveDef.extension}`)
  await execa(
    "7z",
    ["a", "-sccUTF-8", archivePath, path.join(stagingDir, "*")],
    { shell: true }
  )

  // 4. Remove staging dir after successful compression (unless keepTemp)
  if (!keepTemp) {
    await fs.rm(stagingDir, { recursive: true, force: true })
  }
}

/**
 * Process the install section (copies files/dirs directly to output, not compressed).
 */
async function processInstallSection(
  installSection: InstallSection,
  version: string,
  srcDir: string,
  destDir: string,
  logger: BuildLogger
): Promise<void> {
  await fs.mkdir(destDir, { recursive: true })

  // install.files
  if (installSection.files) {
    for (const filePath of installSection.files) {
      const resolvedFilePath = resolvePlaceholders(filePath, version)
      const srcFile = path.join(
        srcDir,
        "install",
        "files",
        ...path.normalize(resolvedFilePath).split(path.sep)
      )
      const destFile = path.join(destDir, path.basename(resolvedFilePath))
      if (await pathExists(srcFile)) {
        try {
          await copyFile(srcFile, destFile)
        } catch (err) {
          logger.warn(
            `Could not copy install file "${resolvedFilePath}": ${err}`
          )
        }
      } else {
        logger.warn(`Install file not found: ${srcFile}`)
      }
    }
  }

  // install.wdlls
  if (installSection.wdlls) {
    for (const w of installSection.wdlls) {
      const wdllsSrc = path.join(srcDir, "install", "wdlls", String(w.version))
      if (await pathExists(wdllsSrc)) {
        try {
          await copyDir(wdllsSrc, destDir)
        } catch (err) {
          logger.warn(`Could not copy install wdlls/${w.version}: ${err}`)
        }
      } else {
        logger.warn(`Install wdlls source not found: ${wdllsSrc}`)
      }
    }
  }

  // install.directories (use SRC_DIR/install/ as the base srcDir)
  if (installSection.directories) {
    const installSrcDir = path.join(srcDir, "install")
    for (const node of installSection.directories) {
      await processDirectoryNode(
        node,
        version,
        installSrcDir,
        destDir,
        logger,
        true
      )
    }
  }
}

/**
 * Main build entry point.
 */
export async function buildPackage(
  packageDef: PackageDefinition,
  resolvedVersion: string,
  inputVersion: string,
  srcDir: string,
  outputDir: string,
  logger: BuildLogger,
  keepTemp = false
): Promise<void> {
  const { v4: uuidv4 } = await import("uuid")
  const tempDir = path.join(outputDir, `TEMP_${uuidv4()}`)
  const outputPackageDir = path.join(outputDir, packageDef.output)

  await fs.mkdir(tempDir, { recursive: true })

  try {
    logger.log(`Starting build for package: ${packageDef.output}`)
    logger.log(`Version: ${inputVersion} (resolved: ${resolvedVersion})`)
    logger.progress(0, packageDef.archives.length)

    // Build each archive
    for (let i = 0; i < packageDef.archives.length; i++) {
      const archive = packageDef.archives[i]
      try {
        await buildArchive(
          archive,
          inputVersion,
          srcDir,
          tempDir,
          logger,
          keepTemp
        )
      } catch (err) {
        logger.error(`Failed to build archive "${archive.name}": ${err}`)
        throw err
      }
      logger.progress(i + 1, packageDef.archives.length)
    }

    // Process install section
    if (packageDef.install) {
      logger.log("Processing install section...")
      await processInstallSection(
        packageDef.install,
        inputVersion,
        srcDir,
        tempDir,
        logger
      )
    }

    // Move temp dir to final output location (atomic-ish)
    await fs.mkdir(path.dirname(outputPackageDir), { recursive: true })
    await fs.rm(outputPackageDir, { recursive: true, force: true })
    await fs.rename(tempDir, outputPackageDir)

    logger.log(`Build complete. Output: ${outputPackageDir}`)
  } catch (err) {
    // Cleanup on failure
    if (!keepTemp) {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {})
    }
    throw err
  }
}
