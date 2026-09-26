-- CreateTable
CREATE TABLE "BaseResume" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "json" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "TailoredApplication" (
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "TailoredApplication_fileName_key" ON "TailoredApplication"("fileName");
