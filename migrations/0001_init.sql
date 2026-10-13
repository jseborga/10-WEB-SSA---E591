-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "titleEn" TEXT,
    "titlePt" TEXT,
    "description" TEXT,
    "descriptionEn" TEXT,
    "descriptionPt" TEXT,
    "fullDescription" TEXT,
    "fullDescriptionEn" TEXT,
    "fullDescriptionPt" TEXT,
    "category" TEXT NOT NULL,
    "location" TEXT,
    "year" INTEGER,
    "area" TEXT,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "showOnHomepage" BOOLEAN NOT NULL DEFAULT false,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" DATETIME,
    "mainImage" TEXT,
    "mainImageAlt" TEXT,
    "mainImageCaption" TEXT,
    "mainImageMobile" TEXT,
    "gallery" TEXT,
    "galleryMobile" TEXT,
    "videoUrl" TEXT,
    "client" TEXT,
    "referenceUrl" TEXT,
    "instagramUrl" TEXT,
    "facebookUrl" TEXT,
    "linkedinUrl" TEXT,
    "youtubeUrl" TEXT,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "seoKeywords" TEXT,
    "projectTags" TEXT,
    "galleryAnnotations" TEXT,
    "galleryMobileAnnotations" TEXT,
    "status" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Publication" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "titleEn" TEXT,
    "titlePt" TEXT,
    "slug" TEXT NOT NULL,
    "excerpt" TEXT,
    "excerptEn" TEXT,
    "excerptPt" TEXT,
    "content" TEXT,
    "contentEn" TEXT,
    "contentPt" TEXT,
    "image" TEXT,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "seoKeywords" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "showInMenu" BOOLEAN NOT NULL DEFAULT false,
    "menuOrder" INTEGER NOT NULL DEFAULT 0,
    "category" TEXT,
    "gallery" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "externalId" TEXT,
    "externalUrl" TEXT,
    "publishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "message" TEXT NOT NULL,
    "isFromAdmin" BOOLEAN NOT NULL DEFAULT false,
    "isFromAI" BOOLEAN NOT NULL DEFAULT false,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "LeadCapture" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'chat-web',
    "name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "telegramHandle" TEXT,
    "preferredContactChannel" TEXT,
    "contactConsent" BOOLEAN NOT NULL DEFAULT false,
    "contactConsentAt" DATETIME,
    "serviceType" TEXT,
    "projectType" TEXT,
    "projectLocation" TEXT,
    "projectIdea" TEXT,
    "summary" TEXT,
    "lastVisitorMessage" TEXT,
    "leadStatus" TEXT NOT NULL DEFAULT 'new',
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "ownerName" TEXT,
    "nextAction" TEXT,
    "nextFollowUpAt" DATETIME,
    "lastContactedAt" DATETIME,
    "internalNotes" TEXT,
    "needsHuman" BOOLEAN NOT NULL DEFAULT false,
    "qualified" BOOLEAN NOT NULL DEFAULT false,
    "telegramNotified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "subject" TEXT,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'new',
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "ownerName" TEXT,
    "nextAction" TEXT,
    "nextFollowUpAt" DATETIME,
    "lastContactedAt" DATETIME,
    "internalNotes" TEXT,
    "aiSummary" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "displayName" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'editor',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "telegramChatId" TEXT,
    "contactPhone" TEXT,
    "workloadCapacity" INTEGER NOT NULL DEFAULT 10,
    "receiveLeadAlerts" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SiteSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyName" TEXT NOT NULL DEFAULT 'SSA Ingenieria',
    "legalName" TEXT,
    "tagline" TEXT,
    "siteUrl" TEXT,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "seoKeywords" TEXT,
    "logoUrl" TEXT,
    "faviconUrl" TEXT,
    "socialShareImageUrl" TEXT,
    "heroImages" TEXT,
    "heroImagesMobile" TEXT,
    "heroMessages" TEXT,
    "heroRotationMs" INTEGER NOT NULL DEFAULT 8600,
    "heroImageOpacity" INTEGER NOT NULL DEFAULT 34,
    "heroImageSaturation" INTEGER NOT NULL DEFAULT 90,
    "heroImageBrightness" INTEGER NOT NULL DEFAULT 100,
    "heroImageContrast" INTEGER NOT NULL DEFAULT 105,
    "heroImageFit" TEXT NOT NULL DEFAULT 'cover',
    "heroImageTreatment" TEXT NOT NULL DEFAULT 'original',
    "heroShowCompanyName" BOOLEAN NOT NULL DEFAULT false,
    "heroTextTone" TEXT NOT NULL DEFAULT 'dark',
    "projectCategories" TEXT,
    "menuConfig" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "whatsapp" TEXT,
    "addressLine" TEXT,
    "city" TEXT,
    "country" TEXT,
    "footerText" TEXT,
    "instagramUrl" TEXT,
    "facebookUrl" TEXT,
    "linkedinUrl" TEXT,
    "youtubeUrl" TEXT,
    "tiktokUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "TelegramConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "botToken" TEXT,
    "botUsername" TEXT,
    "webhookUrl" TEXT,
    "webhookSecret" TEXT,
    "allowedUserIds" TEXT,
    "allowedChatIds" TEXT,
    "autoCreateReviews" BOOLEAN NOT NULL DEFAULT true,
    "autoApproveKnownUsers" BOOLEAN NOT NULL DEFAULT false,
    "defaultProjectCategory" TEXT DEFAULT 'telegram',
    "defaultProjectStatus" TEXT DEFAULT 'received',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "TelegramIdentity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "telegramUserId" TEXT NOT NULL,
    "username" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "isAllowed" BOOLEAN NOT NULL DEFAULT false,
    "lastSeenAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "TelegramConversation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "telegramUserId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "flowType" TEXT,
    "step" TEXT,
    "status" TEXT NOT NULL DEFAULT 'idle',
    "draftData" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "kind" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "originalName" TEXT,
    "mimeType" TEXT,
    "size" INTEGER,
    "url" TEXT NOT NULL,
    "storagePath" TEXT,
    "telegramFileId" TEXT,
    "telegramMessageId" TEXT,
    "telegramChatId" TEXT,
    "telegramUserId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ready',
    "metadata" TEXT,
    "alt" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "parentId" TEXT,
    "editRecipe" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ApprovalItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "details" TEXT,
    "payload" TEXT,
    "requestedByType" TEXT,
    "requestedById" TEXT,
    "approvedBy" TEXT,
    "approvedAt" DATETIME,
    "rejectedAt" DATETIME,
    "rejectionReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AutomationLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "actorType" TEXT,
    "actorId" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "summary" TEXT NOT NULL,
    "payload" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "VisitorSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "landingPath" TEXT,
    "currentPath" TEXT,
    "referrer" TEXT,
    "ipAddress" TEXT,
    "countryHint" TEXT,
    "cityHint" TEXT,
    "userAgent" TEXT,
    "language" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmContent" TEXT,
    "utmTerm" TEXT,
    "entryDevice" TEXT,
    "viewport" TEXT,
    "pageViews" INTEGER NOT NULL DEFAULT 0,
    "eventCount" INTEGER NOT NULL DEFAULT 0,
    "durationSeconds" INTEGER NOT NULL DEFAULT 0,
    "lastEventAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "VisitorEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "path" TEXT,
    "referrer" TEXT,
    "ipAddress" TEXT,
    "durationMs" INTEGER,
    "payload" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ChatConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "provider" TEXT NOT NULL DEFAULT 'default',
    "apiKey" TEXT,
    "apiBaseUrl" TEXT,
    "model" TEXT,
    "automationProvider" TEXT DEFAULT 'google',
    "automationApiKey" TEXT,
    "automationApiBaseUrl" TEXT,
    "automationModel" TEXT,
    "automationFallbackProvider" TEXT DEFAULT 'openrouter',
    "automationFallbackApiKey" TEXT,
    "automationFallbackApiBaseUrl" TEXT,
    "automationFallbackModel" TEXT,
    "imageProvider" TEXT NOT NULL DEFAULT 'google',
    "imageApiKey" TEXT,
    "imageApiBaseUrl" TEXT,
    "imageModel" TEXT,
    "imagePrompt" TEXT,
    "systemPrompt" TEXT NOT NULL,
    "systemPromptEn" TEXT,
    "systemPromptPt" TEXT,
    "welcomeMessage" TEXT,
    "welcomeMessageEn" TEXT,
    "welcomeMessagePt" TEXT,
    "fallbackMessage" TEXT,
    "fallbackMessageEn" TEXT,
    "fallbackMessagePt" TEXT,
    "companyName" TEXT NOT NULL DEFAULT 'estudio591',
    "companyInfo" TEXT,
    "companyInfoEn" TEXT,
    "companyInfoPt" TEXT,
    "temperature" REAL NOT NULL DEFAULT 0.7,
    "maxTokens" INTEGER NOT NULL DEFAULT 1000,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SocialConnection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "pageId" TEXT,
    "pageName" TEXT,
    "igUserId" TEXT,
    "igUsername" TEXT,
    "accessToken" TEXT,
    "tokenExpiresAt" DATETIME,
    "autoPublish" BOOLEAN NOT NULL DEFAULT false,
    "lastSyncAt" DATETIME,
    "lastSyncError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "RateLimitBucket" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "count" INTEGER NOT NULL DEFAULT 0,
    "resetAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Publication_slug_key" ON "Publication"("slug");

-- CreateIndex
CREATE INDEX "Publication_source_externalId_idx" ON "Publication"("source", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "LeadCapture_sessionId_key" ON "LeadCapture"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_username_key" ON "AdminUser"("username");

-- CreateIndex
CREATE UNIQUE INDEX "TelegramIdentity_telegramUserId_key" ON "TelegramIdentity"("telegramUserId");

-- CreateIndex
CREATE UNIQUE INDEX "TelegramConversation_telegramUserId_key" ON "TelegramConversation"("telegramUserId");

-- CreateIndex
CREATE INDEX "MediaAsset_parentId_idx" ON "MediaAsset"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "VisitorSession_sessionId_key" ON "VisitorSession"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "SocialConnection_provider_key" ON "SocialConnection"("provider");

