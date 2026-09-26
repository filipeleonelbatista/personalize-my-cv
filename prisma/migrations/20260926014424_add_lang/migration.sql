-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BaseResume" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "json" TEXT NOT NULL,
    "lang" TEXT NOT NULL DEFAULT 'pt-BR',
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_BaseResume" ("id", "json", "updatedAt") SELECT "id", "json", "updatedAt" FROM "BaseResume";
DROP TABLE "BaseResume";
ALTER TABLE "new_BaseResume" RENAME TO "BaseResume";
CREATE TABLE "new_TailoredApplication" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "jobText" TEXT NOT NULL,
    "cargo" TEXT NOT NULL DEFAULT 'Vaga',
    "empresa" TEXT NOT NULL DEFAULT 'Empresa',
    "fileName" TEXT NOT NULL,
    "pdfPath" TEXT NOT NULL,
    "matchPercent" INTEGER NOT NULL DEFAULT 0,
    "strengths" TEXT NOT NULL,
    "weaknesses" TEXT NOT NULL,
    "emailBody" TEXT NOT NULL DEFAULT '',
    "chatMessage" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'done',
    "errorLog" TEXT NOT NULL DEFAULT '',
    "lang" TEXT NOT NULL DEFAULT 'pt-BR',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_TailoredApplication" ("cargo", "chatMessage", "createdAt", "emailBody", "empresa", "errorLog", "fileName", "id", "jobText", "matchPercent", "pdfPath", "status", "strengths", "weaknesses") SELECT "cargo", "chatMessage", "createdAt", "emailBody", "empresa", "errorLog", "fileName", "id", "jobText", "matchPercent", "pdfPath", "status", "strengths", "weaknesses" FROM "TailoredApplication";
DROP TABLE "TailoredApplication";
ALTER TABLE "new_TailoredApplication" RENAME TO "TailoredApplication";
CREATE UNIQUE INDEX "TailoredApplication_fileName_key" ON "TailoredApplication"("fileName");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
