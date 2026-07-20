import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';
import { Directory, File, Paths } from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import {
  closeDatabase,
  getDatabase,
  reopenDatabase,
} from '@/database';
import { writeAuditLog } from '@/services/auditService';
import { DATABASE_NAME } from '@/utils/constants';

function backupFileName(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `RestaurantPOS_${y}${m}${d}.sqlite`;
}

function ensureBackupsDirectory(): Directory {
  const dir = new Directory(Paths.document, 'RestaurantPOS', 'Backups');
  if (!dir.exists) {
    dir.create({ intermediates: true, idempotent: true });
  }
  return dir;
}

export async function exportDatabaseBackup(actorId: number): Promise<{
  fileName: string;
  uri: string;
}> {
  if (Platform.OS === 'web') {
    throw new Error('Database backup is not available on web');
  }

  const dir = ensureBackupsDirectory();
  const fileName = backupFileName();
  const existing = new File(dir, fileName);
  if (existing.exists) {
    existing.delete();
  }

  const source = await getDatabase();
  const dest = await SQLite.openDatabaseAsync(fileName, undefined, dir.uri);
  try {
    await SQLite.backupDatabaseAsync({
      sourceDatabase: source,
      destDatabase: dest,
    });
  } finally {
    await dest.closeAsync();
  }

  const file = new File(dir, fileName);
  if (!file.exists) {
    throw new Error('Backup file was not created');
  }

  await writeAuditLog({
    userId: actorId,
    action: 'DATABASE_BACKUP',
    entityType: 'database',
    details: { fileName, uri: file.uri },
  });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/x-sqlite3',
      dialogTitle: 'Export database backup',
      UTI: 'public.database',
    });
  }

  return { fileName, uri: file.uri };
}

export async function restoreDatabaseBackup(actorId: number): Promise<void> {
  if (Platform.OS === 'web') {
    throw new Error('Database restore is not available on web');
  }

  const picked = await DocumentPicker.getDocumentAsync({
    copyToCacheDirectory: true,
    multiple: false,
    type: '*/*',
  });

  if (picked.canceled || !picked.assets?.[0]) {
    throw new Error('Restore cancelled');
  }

  const asset = picked.assets[0];
  const sourceUri = asset.uri;
  const sourceFile = new File(sourceUri);
  if (!sourceFile.exists) {
    throw new Error('Selected backup file could not be read');
  }

  const live = await getDatabase();
  const livePath = live.databasePath;
  await closeDatabase();

  try {
    // Open picked file as a SQLite DB (copy into cache dir first if needed)
    const stagingName = `restore_staging_${Date.now()}.sqlite`;
    const stagingDir = Paths.cache;
    const stagingFile = new File(stagingDir, stagingName);
    if (stagingFile.exists) stagingFile.delete();
    sourceFile.copy(stagingFile);

    const sourceDb = await SQLite.openDatabaseAsync(
      stagingName,
      undefined,
      stagingDir.uri
    );

    try {
      // Replace live DB contents via SQLite backup API
      await SQLite.deleteDatabaseAsync(DATABASE_NAME);
      const destDb = await SQLite.openDatabaseAsync(DATABASE_NAME);
      try {
        await SQLite.backupDatabaseAsync({
          sourceDatabase: sourceDb,
          destDatabase: destDb,
        });
      } finally {
        await destDb.closeAsync();
      }
    } finally {
      await sourceDb.closeAsync();
      if (stagingFile.exists) stagingFile.delete();
    }

    await reopenDatabase();

    await writeAuditLog({
      userId: actorId,
      action: 'DATABASE_RESTORE',
      entityType: 'database',
      details: {
        from: asset.name ?? sourceUri,
        livePath,
      },
    });
  } catch (error) {
    // Best effort reopen so the app is not left without a DB
    try {
      await reopenDatabase();
    } catch {
      // ignore
    }
    throw error instanceof Error
      ? error
      : new Error('Failed to restore database');
  }
}

export function getBackupsFolderLabel(): string {
  return 'Documents/RestaurantPOS/Backups';
}
