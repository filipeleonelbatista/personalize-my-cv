// mobile/lib/backup-files.ts
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import { exportBackup, importBackup } from "./store";

export async function exportBackupToFile(): Promise<string> {
  const name = `pmcv-backup-${new Date().toISOString().slice(0, 10)}.json`;
  const dest = `${FileSystem.documentDirectory}${name}`;
  await FileSystem.writeAsStringAsync(dest, await exportBackup());
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(dest);
  return dest;
}

export async function importBackupFromFile(): Promise<void> {
  const r = await DocumentPicker.getDocumentAsync({ type: "application/json", copyToCacheDirectory: true });
  if (r.canceled || !r.assets?.[0]) return;
  const json = await FileSystem.readAsStringAsync(r.assets[0].uri);
  await importBackup(json);
}
