-- CreateEnum
CREATE TYPE "public"."Gender" AS ENUM ('FEMALE', 'MALE', 'NON_BINARY', 'OTHER', 'PREFER_NOT_TO_SAY');

-- CreateEnum
CREATE TYPE "public"."ActionStatus" AS ENUM ('SUCCESS', 'FAILED');

-- CreateTable

CREATE TABLE "public"."MasterData" (
    "masterDataId" VARCHAR(36) NOT NULL,
    "recSeq" INTEGER NOT NULL DEFAULT 0,
    "recStatus" TEXT NOT NULL DEFAULT 'A',
    "keyCode" VARCHAR(50) NOT NULL,
    "value" VARCHAR(50),
    "parentId" VARCHAR(50),
    "dataStatus" VARCHAR(1) NOT NULL DEFAULT 'A',
    "createdBy" TEXT NOT NULL DEFAULT 'System',
    "createdOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifiedOn" TIMESTAMP(3) NOT NULL,
    "modifiedBy" VARCHAR(50),

    CONSTRAINT "MasterData_pkey" PRIMARY KEY ("masterDataId","recSeq")
);

-- CreateTable

CREATE TABLE "public"."Users" (
    "userId" VARCHAR(36) NOT NULL,
    "recSeq" INTEGER NOT NULL DEFAULT 0,
    "recStatus" TEXT NOT NULL DEFAULT 'A',
    "email" TEXT,
    "phoneNumber" TEXT NOT NULL DEFAULT '',
    "firstName" VARCHAR(50),
    "lastName" VARCHAR(50),
    "username" VARCHAR(50),
    "tagline" VARCHAR(100),
    "dateOfBirth" DATE,
    "gender" "public"."Gender",
    "avatarId" VARCHAR(36),
    "avatarRecSeq" INTEGER DEFAULT 0,
    "isProfileComplete" BOOLEAN NOT NULL DEFAULT false,
    "dataStatus" VARCHAR(1) NOT NULL DEFAULT 'A',
    "createdBy" TEXT NOT NULL DEFAULT 'System',
    "createdOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifiedOn" TIMESTAMP(3) NOT NULL,
    "modifiedBy" VARCHAR(50),

    CONSTRAINT "Users_pkey" PRIMARY KEY ("userId","recSeq")
);

-- CreateTable

CREATE TABLE "public"."LoginActionHistory" (
    "loginActionHistoryId" VARCHAR(36) NOT NULL,
    "recSeq" INTEGER NOT NULL DEFAULT 0,
    "recStatus" TEXT NOT NULL DEFAULT 'A',
    "userId" VARCHAR(36) NOT NULL,
    "userRecSeq" INTEGER NOT NULL DEFAULT 0,
    "action" VARCHAR(50) NOT NULL,
    "actionOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actionStatus" "public"."ActionStatus" NOT NULL DEFAULT 'SUCCESS',
    "reason" VARCHAR(100),
    "dataStatus" VARCHAR(1) NOT NULL DEFAULT 'A',
    "createdBy" TEXT NOT NULL DEFAULT 'System',
    "createdOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifiedOn" TIMESTAMP(3) NOT NULL,
    "modifiedBy" VARCHAR(50),

    CONSTRAINT "LoginActionHistory_pkey" PRIMARY KEY ("loginActionHistoryId","recSeq")
);

-- CreateTable

CREATE TABLE "public"."Integrations" (
    "integrationId" VARCHAR(36) NOT NULL,
    "recSeq" INTEGER NOT NULL DEFAULT 0,
    "recStatus" TEXT NOT NULL DEFAULT 'A',
    "name" VARCHAR(50) NOT NULL,
    "label" VARCHAR(50),
    "popularity" INTEGER,
    "dataStatus" VARCHAR(1) NOT NULL DEFAULT 'A',
    "createdBy" TEXT NOT NULL DEFAULT 'System',
    "createdOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifiedOn" TIMESTAMP(3) NOT NULL,
    "modifiedBy" VARCHAR(50),

    CONSTRAINT "Integrations_pkey" PRIMARY KEY ("integrationId","recSeq")
);

-- CreateTable

CREATE TABLE "public"."Lists" (
    "listId" VARCHAR(36) NOT NULL,
    "recSeq" INTEGER NOT NULL DEFAULT 0,
    "recStatus" TEXT NOT NULL DEFAULT 'A',
    "name" VARCHAR(50) NOT NULL,
    "dataStatus" VARCHAR(1) NOT NULL DEFAULT 'A',
    "createdBy" TEXT NOT NULL DEFAULT 'System',
    "createdOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifiedOn" TIMESTAMP(3) NOT NULL,
    "modifiedBy" VARCHAR(50),

    CONSTRAINT "Lists_pkey" PRIMARY KEY ("listId","recSeq")
);

-- CreateTable

CREATE TABLE "public"."ListIntegrationMapping" (
    "listIntegrationMappingId" VARCHAR(36) NOT NULL,
    "recSeq" INTEGER NOT NULL DEFAULT 0,
    "recStatus" TEXT NOT NULL DEFAULT 'A',
    "listId" VARCHAR(36) NOT NULL,
    "listRecSeq" INTEGER NOT NULL DEFAULT 0,
    "integrationId" VARCHAR(36) NOT NULL,
    "integrationRecSeq" INTEGER NOT NULL DEFAULT 0,
    "dataStatus" VARCHAR(1) NOT NULL DEFAULT 'A',
    "createdBy" TEXT NOT NULL DEFAULT 'System',
    "createdOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifiedOn" TIMESTAMP(3) NOT NULL,
    "modifiedBy" VARCHAR(50),

    CONSTRAINT "ListIntegrationMapping_pkey" PRIMARY KEY ("listIntegrationMappingId","recSeq")
);

-- CreateTable

CREATE TABLE "public"."UserIntegrations" (
    "userIntegrationId" VARCHAR(36) NOT NULL,
    "recSeq" INTEGER NOT NULL DEFAULT 0,
    "recStatus" TEXT NOT NULL DEFAULT 'A',
    "userId" VARCHAR(36) NOT NULL,
    "userRecSeq" INTEGER NOT NULL DEFAULT 0,
    "integrationId" VARCHAR(36) NOT NULL,
    "integrationRecSeq" INTEGER NOT NULL DEFAULT 0,
    "status" VARCHAR(50) NOT NULL,
    "dataStatus" VARCHAR(1) NOT NULL DEFAULT 'A',
    "createdBy" TEXT NOT NULL DEFAULT 'System',
    "createdOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifiedOn" TIMESTAMP(3) NOT NULL,
    "modifiedBy" VARCHAR(50),

    CONSTRAINT "UserIntegrations_pkey" PRIMARY KEY ("userIntegrationId","recSeq")
);

-- CreateTable

CREATE TABLE "public"."UserIntegrationHistory" (
    "userIntegrationHistoryId" VARCHAR(36) NOT NULL,
    "recSeq" INTEGER NOT NULL DEFAULT 0,
    "recStatus" TEXT NOT NULL DEFAULT 'A',
    "userIntegrationId" VARCHAR(36) NOT NULL,
    "userIntegrationRecSeq" INTEGER NOT NULL DEFAULT 0,
    "firstConnectedAt" DATE,
    "lastConnectedAt" DATE,
    "lastSyncedAt" DATE,
    "dataStatus" VARCHAR(1) NOT NULL DEFAULT 'A',
    "createdBy" TEXT NOT NULL DEFAULT 'System',
    "createdOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifiedOn" TIMESTAMP(3) NOT NULL,
    "modifiedBy" VARCHAR(50),

    CONSTRAINT "UserIntegrationHistory_pkey" PRIMARY KEY ("userIntegrationHistoryId","recSeq")
);

-- CreateTable

CREATE TABLE "public"."UserLists" (
    "userListId" VARCHAR(36) NOT NULL,
    "recSeq" INTEGER NOT NULL DEFAULT 0,
    "recStatus" TEXT NOT NULL DEFAULT 'A',
    "userId" VARCHAR(36) NOT NULL,
    "userRecSeq" INTEGER NOT NULL DEFAULT 0,
    "listId" VARCHAR(36) NOT NULL,
    "listRecSeq" INTEGER NOT NULL DEFAULT 0,
    "customName" VARCHAR(50),
    "dataStatus" VARCHAR(1) NOT NULL DEFAULT 'A',
    "createdBy" TEXT NOT NULL DEFAULT 'System',
    "createdOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifiedOn" TIMESTAMP(3) NOT NULL,
    "modifiedBy" VARCHAR(50),

    CONSTRAINT "UserLists_pkey" PRIMARY KEY ("userListId","recSeq")
);

-- CreateTable

CREATE TABLE "public"."ItemCategories" (
    "itemCategoryId" VARCHAR(36) NOT NULL,
    "recSeq" INTEGER NOT NULL DEFAULT 0,
    "recStatus" TEXT NOT NULL DEFAULT 'A',
    "listId" VARCHAR(36) NOT NULL,
    "listRecSeq" INTEGER NOT NULL DEFAULT 0,
    "name" VARCHAR(50) NOT NULL,
    "dataStatus" VARCHAR(1) NOT NULL DEFAULT 'A',
    "createdBy" TEXT NOT NULL DEFAULT 'System',
    "createdOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifiedOn" TIMESTAMP(3) NOT NULL,
    "modifiedBy" VARCHAR(50),

    CONSTRAINT "ItemCategories_pkey" PRIMARY KEY ("itemCategoryId","recSeq")
);

-- CreateTable

CREATE TABLE "public"."ListItems" (
    "listItemId" VARCHAR(36) NOT NULL,
    "recSeq" INTEGER NOT NULL DEFAULT 0,
    "recStatus" TEXT NOT NULL DEFAULT 'A',
    "listId" VARCHAR(36) NOT NULL,
    "listRecSeq" INTEGER NOT NULL DEFAULT 0,
    "categoryId" VARCHAR(36),
    "categoryRecSeq" INTEGER DEFAULT 0,
    "userListId" VARCHAR(36),
    "userListRecSeq" INTEGER DEFAULT 0,
    "title" VARCHAR(50),
    "notes" VARCHAR(50),
    "starred" BOOLEAN NOT NULL DEFAULT false,
    "attributes" JSON,
    "attributeDataType" JSON,
    "unit" JSON,
    "dataStatus" VARCHAR(1) NOT NULL DEFAULT 'A',
    "createdBy" TEXT NOT NULL DEFAULT 'System',
    "createdOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifiedOn" TIMESTAMP(3) NOT NULL,
    "modifiedBy" VARCHAR(50),

    CONSTRAINT "ListItems_pkey" PRIMARY KEY ("listItemId","recSeq")
);

-- CreateTable

CREATE TABLE "public"."Logtable" (
    "id" SERIAL NOT NULL,
    "requestId" TEXT,
    "log" TEXT,

    CONSTRAINT "Logtable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LocationDataSubmissions" (
    "locationDataSubmissionId" VARCHAR(36) NOT NULL,
    "recSeq" INTEGER NOT NULL DEFAULT 0,
    "recStatus" TEXT NOT NULL DEFAULT 'A',
    "userId" VARCHAR(36) NOT NULL,
    "userRecSeq" INTEGER NOT NULL DEFAULT 0,
    "integrationId" VARCHAR(36) NOT NULL,
    "integrationRecSeq" INTEGER NOT NULL DEFAULT 0,
    "locationData" JSON NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "dataStatus" VARCHAR(1) NOT NULL DEFAULT 'A',
    "createdBy" TEXT NOT NULL DEFAULT 'System',
    "createdOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifiedOn" TIMESTAMP(3) NOT NULL,
    "modifiedBy" VARCHAR(50),
    CONSTRAINT "LocationDataSubmissions_pkey" PRIMARY KEY (
        "locationDataSubmissionId",
        "recSeq"
    )
);

-- CreateIndex
CREATE INDEX "LocationDataSubmissions_userId_integrationId_processed_idx" ON "LocationDataSubmissions" (
    "userId",
    "integrationId",
    "processed"
);

-- CreateTable

CREATE TABLE "public"."OAuthCredentials" (
    "oauthCredentialId" VARCHAR(36) NOT NULL,
    "recSeq" INTEGER NOT NULL DEFAULT 0,
    "recStatus" TEXT NOT NULL DEFAULT 'A',
    "userId" VARCHAR(36) NOT NULL,
    "userRecSeq" INTEGER NOT NULL DEFAULT 0,
    "integrationId" VARCHAR(36) NOT NULL,
    "integrationRecSeq" INTEGER NOT NULL DEFAULT 0,
    "accessTokenEnc" TEXT NOT NULL,
    "refreshTokenEnc" TEXT,
    "expiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "providerUserId" TEXT,
    "dataStatus" VARCHAR(1) NOT NULL DEFAULT 'A',
    "createdBy" TEXT NOT NULL DEFAULT 'System',
    "createdOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifiedOn" TIMESTAMP(3) NOT NULL,
    "modifiedBy" VARCHAR(50),

    CONSTRAINT "OAuthCredentials_pkey" PRIMARY KEY ("oauthCredentialId","recSeq")
);

-- CreateIndex
CREATE UNIQUE INDEX "OAuthCredentials_userId_userRecSeq_integrationId_integratio_key" ON "public"."OAuthCredentials"("userId", "userRecSeq", "integrationId", "integrationRecSeq");

-- AddForeignKey
ALTER TABLE "public"."OAuthCredentials" ADD CONSTRAINT "OAuthCredentials_userId_userRecSeq_fkey" FOREIGN KEY ("userId", "userRecSeq") REFERENCES "public"."Users"("userId", "recSeq") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OAuthCredentials" ADD CONSTRAINT "OAuthCredentials_integrationId_integrationRecSeq_fkey" FOREIGN KEY ("integrationId", "integrationRecSeq") REFERENCES "public"."Integrations"("integrationId", "recSeq") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocationDataSubmissions"
ADD CONSTRAINT "LocationDataSubmissions_userId_userRecSeq_fkey" FOREIGN KEY ("userId", "userRecSeq") REFERENCES "Users" ("userId", "recSeq") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocationDataSubmissions"
ADD CONSTRAINT "LocationDataSubmissions_integrationId_integrationRecSeq_fkey" FOREIGN KEY (
    "integrationId",
    "integrationRecSeq"
) REFERENCES "Integrations" ("integrationId", "recSeq") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE UNIQUE INDEX "Users_userId_email_phoneNumber_username_recSeq_key" ON "public"."Users"("userId", "email", "phoneNumber", "username", "recSeq");

-- AddForeignKey
ALTER TABLE "public"."Users" ADD CONSTRAINT "Users_avatarId_avatarRecSeq_fkey" FOREIGN KEY ("avatarId", "avatarRecSeq") REFERENCES "public"."MasterData"("masterDataId", "recSeq") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LoginActionHistory" ADD CONSTRAINT "LoginActionHistory_userId_userRecSeq_fkey" FOREIGN KEY ("userId", "userRecSeq") REFERENCES "public"."Users"("userId", "recSeq") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ListIntegrationMapping" ADD CONSTRAINT "ListIntegrationMapping_listId_listRecSeq_fkey" FOREIGN KEY ("listId", "listRecSeq") REFERENCES "public"."Lists"("listId", "recSeq") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ListIntegrationMapping" ADD CONSTRAINT "ListIntegrationMapping_integrationId_integrationRecSeq_fkey" FOREIGN KEY ("integrationId", "integrationRecSeq") REFERENCES "public"."Integrations"("integrationId", "recSeq") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserIntegrations" ADD CONSTRAINT "UserIntegrations_userId_userRecSeq_fkey" FOREIGN KEY ("userId", "userRecSeq") REFERENCES "public"."Users"("userId", "recSeq") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserIntegrations" ADD CONSTRAINT "UserIntegrations_integrationId_integrationRecSeq_fkey" FOREIGN KEY ("integrationId", "integrationRecSeq") REFERENCES "public"."Integrations"("integrationId", "recSeq") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserIntegrationHistory" ADD CONSTRAINT "UserIntegrationHistory_userIntegrationId_userIntegrationRe_fkey" FOREIGN KEY ("userIntegrationId", "userIntegrationRecSeq") REFERENCES "public"."UserIntegrations"("userIntegrationId", "recSeq") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserLists" ADD CONSTRAINT "UserLists_userId_userRecSeq_fkey" FOREIGN KEY ("userId", "userRecSeq") REFERENCES "public"."Users"("userId", "recSeq") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserLists" ADD CONSTRAINT "UserLists_listId_listRecSeq_fkey" FOREIGN KEY ("listId", "listRecSeq") REFERENCES "public"."Lists"("listId", "recSeq") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ItemCategories" ADD CONSTRAINT "ItemCategories_listId_listRecSeq_fkey" FOREIGN KEY ("listId", "listRecSeq") REFERENCES "public"."Lists"("listId", "recSeq") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ListItems" ADD CONSTRAINT "ListItems_listId_listRecSeq_fkey" FOREIGN KEY ("listId", "listRecSeq") REFERENCES "public"."Lists"("listId", "recSeq") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ListItems" ADD CONSTRAINT "ListItems_categoryId_categoryRecSeq_fkey" FOREIGN KEY ("categoryId", "categoryRecSeq") REFERENCES "public"."ItemCategories"("itemCategoryId", "recSeq") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ListItems" ADD CONSTRAINT "ListItems_userListId_userListRecSeq_fkey" FOREIGN KEY ("userListId", "userListRecSeq") REFERENCES "public"."UserLists"("userListId", "recSeq") ON DELETE CASCADE ON UPDATE CASCADE;

-- Insert
INSERT INTO "public"."Lists" ("listId", "name", "createdBy", "createdOn", "modifiedOn") VALUES ('ddb7c814-4c2b-467c-9584-8333b6510c72', 'Health', 'System', NOW(), NOW());

INSERT INTO "public"."Lists" ("listId", "name", "createdBy", "createdOn", "modifiedOn") VALUES ('61a8ad17-e520-4ef7-9265-6e39aeb8d41a', 'Activity', 'System', NOW(), NOW());

INSERT INTO "public"."Lists" ("listId", "name", "createdBy", "createdOn", "modifiedOn") VALUES ('c8e41c92-af26-469c-82a0-73dc9b9e84eb', 'Travel', 'System', NOW(), NOW());

INSERT INTO "public"."Lists" ("listId", "name", "createdBy", "createdOn", "modifiedOn") VALUES ('9f9a5a32-f35b-4fe0-9cca-0cf6b0a8c831', 'Transport', 'System', NOW(), NOW());

INSERT INTO "public"."Lists" ("listId", "name", "createdBy", "createdOn", "modifiedOn") VALUES ('d323558f-a4eb-490a-8a44-3fd5d1863880', 'Places Visited', 'System', NOW(), NOW());

INSERT INTO "public"."Lists" ("listId", "name", "createdBy", "createdOn", "modifiedOn") VALUES ('3251f2b8-8e65-413c-a2d5-2414e5fcbd1e', 'Food', 'System', NOW(), NOW());

INSERT INTO "public"."Lists" ("listId", "name", "createdBy", "createdOn", "modifiedOn") VALUES ('c95706fc-d858-4ea3-80e1-990ff0a8c520', 'Friends', 'System', NOW(), NOW());

INSERT INTO "public"."Lists" ("listId", "name", "createdBy", "createdOn", "modifiedOn") VALUES ('e4ea1042-bb7b-4d09-85fb-9ab93a507321', 'Events', 'System', NOW(), NOW());

INSERT INTO "public"."Lists" ("listId", "name", "createdBy", "createdOn", "modifiedOn") VALUES ('fdb2e117-519a-4844-a438-6214313c64fe', 'Music', 'System', NOW(), NOW());

INSERT INTO "public"."Lists" ("listId", "name", "createdBy", "createdOn", "modifiedOn") VALUES ('a946acdb-b303-4b31-bb05-d07274d0a5da', 'Books', 'System', NOW(), NOW());

INSERT INTO "public"."Lists" ("listId", "name", "createdBy", "createdOn", "modifiedOn") VALUES ('7b870e21-d1d0-43b7-81d6-ca7e728c85e8', 'Custom', 'System', NOW(), NOW());

INSERT INTO "public"."ItemCategories" ("itemCategoryId", "listId", "listRecSeq", "name", "createdBy", "createdOn", "modifiedOn") VALUES ('6f1c0f2d-89a8-4c5f-9c6a-1d9a24b5f041', 'ddb7c814-4c2b-467c-9584-8333b6510c72', 0, 'Steps', 'System', NOW(), NOW());

INSERT INTO "public"."ItemCategories" ("itemCategoryId", "listId", "listRecSeq", "name", "createdBy", "createdOn", "modifiedOn") VALUES ('3b2a94e7-4e9c-4f93-90d1-29cbfa5aebd7', 'ddb7c814-4c2b-467c-9584-8333b6510c72', 0, 'Miles', 'System', NOW(), NOW());

INSERT INTO "public"."ItemCategories" ("itemCategoryId", "listId", "listRecSeq", "name", "createdBy", "createdOn", "modifiedOn") VALUES ('8c5a7e8e-7f03-4b0c-9b2d-75ae9bcde9c1', 'ddb7c814-4c2b-467c-9584-8333b6510c72', 0, 'Sleep', 'System', NOW(), NOW());

INSERT INTO "public"."ItemCategories" ("itemCategoryId", "listId", "listRecSeq", "name", "createdBy", "createdOn", "modifiedOn") VALUES ('1f9d3a44-8f94-4f3a-8d5c-2ae0f51e2d6b', 'ddb7c814-4c2b-467c-9584-8333b6510c72', 0, 'Heart Rate', 'System', NOW(), NOW());

INSERT INTO "public"."ItemCategories" ("itemCategoryId", "listId", "listRecSeq", "name", "createdBy", "createdOn", "modifiedOn") VALUES ('4a6f292a-95a4-4a92-8a3e-3916b8f20f5d', 'ddb7c814-4c2b-467c-9584-8333b6510c72', 0, 'VO2 Max', 'System', NOW(), NOW());

INSERT INTO "public"."ItemCategories" ("itemCategoryId", "listId", "listRecSeq", "name", "createdBy", "createdOn", "modifiedOn") VALUES ('e5c4d7b7-fb9d-4a59-9c5f-7c55d6e5f9d8', '61a8ad17-e520-4ef7-9265-6e39aeb8d41a', 0, 'Run', 'System', NOW(), NOW());

INSERT INTO "public"."ItemCategories" ("itemCategoryId", "listId", "listRecSeq", "name", "createdBy", "createdOn", "modifiedOn") VALUES ('0e728923-ccf8-4a7b-8f44-1fa348e346a9', '61a8ad17-e520-4ef7-9265-6e39aeb8d41a', 0, 'Bike', 'System', NOW(), NOW());

INSERT INTO "public"."ItemCategories" ("itemCategoryId", "listId", "listRecSeq", "name", "createdBy", "createdOn", "modifiedOn") VALUES ('2d9a6f6e-1c7e-4a34-8795-6e92c9e0ef59', '61a8ad17-e520-4ef7-9265-6e39aeb8d41a', 0, 'Swim', 'System', NOW(), NOW());

INSERT INTO "public"."ItemCategories" ("itemCategoryId", "listId", "listRecSeq", "name", "createdBy", "createdOn", "modifiedOn") VALUES ('6a3f5bfc-7d6b-4c1a-b79f-94d3a4a7f123', '61a8ad17-e520-4ef7-9265-6e39aeb8d41a', 0, 'Strength', 'System', NOW(), NOW());

INSERT INTO "public"."ItemCategories" ("itemCategoryId", "listId", "listRecSeq", "name", "createdBy", "createdOn", "modifiedOn") VALUES ('3e7fbc08-7a2a-4d29-aac4-3a9b8f1e4c5d', '61a8ad17-e520-4ef7-9265-6e39aeb8d41a', 0, 'Hike', 'System', NOW(), NOW());

INSERT INTO "public"."ItemCategories" ("itemCategoryId", "listId", "listRecSeq", "name", "createdBy", "createdOn", "modifiedOn") VALUES ('78f5e642-cd8a-43d9-9c07-06e7a8e01c27', '61a8ad17-e520-4ef7-9265-6e39aeb8d41a', 0, 'Walk', 'System', NOW(), NOW());

INSERT INTO "public"."ItemCategories" ("itemCategoryId", "listId", "listRecSeq", "name", "createdBy", "createdOn", "modifiedOn") VALUES ('b291d9a1-8f3d-4e9a-9238-3e1f9c5e4b18', '61a8ad17-e520-4ef7-9265-6e39aeb8d41a', 0, 'Tennis', 'System', NOW(), NOW());

INSERT INTO "public"."ItemCategories" ("itemCategoryId", "listId", "listRecSeq", "name", "createdBy", "createdOn", "modifiedOn") VALUES ('a9d3e2c7-3e69-4f72-b64f-22f1d8b9e98e', '61a8ad17-e520-4ef7-9265-6e39aeb8d41a', 0, 'Pickleball', 'System', NOW(), NOW());

INSERT INTO "public"."ItemCategories" ("itemCategoryId", "listId", "listRecSeq", "name", "createdBy", "createdOn", "modifiedOn") VALUES ('37e59d1f-7a2b-4a48-83f6-6f3a7c9d7e58', '61a8ad17-e520-4ef7-9265-6e39aeb8d41a', 0, 'Group Sport', 'System', NOW(), NOW());

INSERT INTO "public"."ItemCategories" ("itemCategoryId", "listId", "listRecSeq", "name", "createdBy", "createdOn", "modifiedOn") VALUES ('5f8e29c7-b9c4-4e92-98e1-2a71f6b8d4c0', '61a8ad17-e520-4ef7-9265-6e39aeb8d41a', 0, 'Other', 'System', NOW(), NOW());

INSERT INTO "public"."ItemCategories" ("itemCategoryId", "listId", "listRecSeq", "name", "createdBy", "createdOn", "modifiedOn") VALUES ('c1f92e6a-3d45-4a7c-98d1-57f8a9b23e9f', 'c8e41c92-af26-469c-82a0-73dc9b9e84eb', 0, 'Domestic', 'System', NOW(), NOW());

INSERT INTO "public"."ItemCategories" ("itemCategoryId", "listId", "listRecSeq", "name", "createdBy", "createdOn", "modifiedOn") VALUES ('14b0a7d2-89c5-40c7-956b-2d1a7f8e6c94', 'c8e41c92-af26-469c-82a0-73dc9b9e84eb', 0, 'International', 'System', NOW(), NOW());

INSERT INTO "public"."ItemCategories" ("itemCategoryId", "listId", "listRecSeq", "name", "createdBy", "createdOn", "modifiedOn") VALUES ('9f4d0c3e-73a2-48f7-9bde-4a3e1c9b6f7a', '9f9a5a32-f35b-4fe0-9cca-0cf6b0a8c831', 0, 'Public Transport', 'System', NOW(), NOW());

INSERT INTO "public"."ItemCategories" ("itemCategoryId", "listId", "listRecSeq", "name", "createdBy", "createdOn", "modifiedOn") VALUES ('33a9e7d0-b4f9-48e7-8b3a-15d6f2c9a78e', '9f9a5a32-f35b-4fe0-9cca-0cf6b0a8c831', 0, 'RideShare', 'System', NOW(), NOW());

INSERT INTO "public"."ItemCategories" ("itemCategoryId", "listId", "listRecSeq", "name", "createdBy", "createdOn", "modifiedOn") VALUES ('1c6e9f3a-9f42-4d7c-b4e7-7e8f6d5c4b21', '9f9a5a32-f35b-4fe0-9cca-0cf6b0a8c831', 0, 'Airplane', 'System', NOW(), NOW());

INSERT INTO "public"."ItemCategories" ("itemCategoryId", "listId", "listRecSeq", "name", "createdBy", "createdOn", "modifiedOn") VALUES ('6f9b7a21-8d3f-4e6a-9d1c-3e5a7f2b8c09', '9f9a5a32-f35b-4fe0-9cca-0cf6b0a8c831', 0, 'Car', 'System', NOW(), NOW());

INSERT INTO "public"."ItemCategories" ("itemCategoryId", "listId", "listRecSeq", "name", "createdBy", "createdOn", "modifiedOn") VALUES ('9e6c1f4a-3b5d-4e7b-d9af-2c6f8e4d1a3b', '9f9a5a32-f35b-4fe0-9cca-0cf6b0a8c831', 0, 'Train', 'System', NOW(), NOW());

INSERT INTO "public"."ItemCategories" ("itemCategoryId", "listId", "listRecSeq", "name", "createdBy", "createdOn", "modifiedOn") VALUES ('58c7b4e9-2a1f-4d93-8f7a-9b6d3e0c5a1f', 'd323558f-a4eb-490a-8a44-3fd5d1863880', 0, 'Grocery Stores', 'System', NOW(), NOW());

INSERT INTO "public"."ItemCategories" ("itemCategoryId", "listId", "listRecSeq", "name", "createdBy", "createdOn", "modifiedOn") VALUES ('d4e8f9a3-7c1b-4a58-9f3e-6d7a2c8e0b49', 'd323558f-a4eb-490a-8a44-3fd5d1863880', 0, 'Parks', 'System', NOW(), NOW());

INSERT INTO "public"."ItemCategories" ("itemCategoryId", "listId", "listRecSeq", "name", "createdBy", "createdOn", "modifiedOn") VALUES ('5a7e6f3c-4b2d-49f8-9a1e-3f5c7d2b8e90', 'd323558f-a4eb-490a-8a44-3fd5d1863880', 0, 'Museums', 'System', NOW(), NOW());

INSERT INTO "public"."ItemCategories" ("itemCategoryId", "listId", "listRecSeq", "name", "createdBy", "createdOn", "modifiedOn") VALUES ('2c9f7a1e-5d3b-4e8c-b97f-0a4d6e2c9b18', 'd323558f-a4eb-490a-8a44-3fd5d1863880', 0, 'Friends Homes', 'System', NOW(), NOW());

INSERT INTO "public"."ItemCategories" ("itemCategoryId", "listId", "listRecSeq", "name", "createdBy", "createdOn", "modifiedOn") VALUES ('7c4a9d2e-1f3b-4e8c-b97f-0a4d6e2c9b19', 'd323558f-a4eb-490a-8a44-3fd5d1863880', 0, 'Online Stores', 'System', NOW(), NOW());

INSERT INTO "public"."ItemCategories" ("itemCategoryId", "listId", "listRecSeq", "name", "createdBy", "createdOn", "modifiedOn") VALUES ('8d5b0e3f-2a4c-4f9d-ca8e-1b5e7f3d0c2a', 'd323558f-a4eb-490a-8a44-3fd5d1863880', 0, 'Retail Stores', 'System', NOW(), NOW());

INSERT INTO "public"."ItemCategories" ("itemCategoryId", "listId", "listRecSeq", "name", "createdBy", "createdOn", "modifiedOn") VALUES ('8d6e5c7b-9a1f-4b2d-8f3e-7c0a5e9d4b63', '3251f2b8-8e65-413c-a2d5-2414e5fcbd1e', 0, 'Coffee Shops', 'System', NOW(), NOW());

INSERT INTO "public"."ItemCategories" ("itemCategoryId", "listId", "listRecSeq", "name", "createdBy", "createdOn", "modifiedOn") VALUES ('1e7f8c9a-3b4d-4e5f-9a2b-6d0c7e1f9a82', '3251f2b8-8e65-413c-a2d5-2414e5fcbd1e', 0, 'Breakfast', 'System', NOW(), NOW());

INSERT INTO "public"."ItemCategories" ("itemCategoryId", "listId", "listRecSeq", "name", "createdBy", "createdOn", "modifiedOn") VALUES ('73b9a6f2-c8d5-4e1f-9b3a-0c7d8e5a4f19', '3251f2b8-8e65-413c-a2d5-2414e5fcbd1e', 0, 'Lunch', 'System', NOW(), NOW());

INSERT INTO "public"."ItemCategories" ("itemCategoryId", "listId", "listRecSeq", "name", "createdBy", "createdOn", "modifiedOn") VALUES ('9a2c7f1e-5b4d-4e9a-8c3f-6d0a7e2c5b18', '3251f2b8-8e65-413c-a2d5-2414e5fcbd1e', 0, 'Dinner', 'System', NOW(), NOW());

INSERT INTO "public"."ItemCategories" ("itemCategoryId", "listId", "listRecSeq", "name", "createdBy", "createdOn", "modifiedOn") VALUES ('4e8b7d9a-1f3c-4a6e-9b2d-7c0f5e8a3d49', '3251f2b8-8e65-413c-a2d5-2414e5fcbd1e', 0, 'Sweet Treat', 'System', NOW(), NOW());

INSERT INTO "public"."ItemCategories" ("itemCategoryId", "listId", "listRecSeq", "name", "createdBy", "createdOn", "modifiedOn") VALUES ('3d6f9a7c-2b4e-4e1f-8c7a-0d5e9b2f4a63', '3251f2b8-8e65-413c-a2d5-2414e5fcbd1e', 0, 'Drinks', 'System', NOW(), NOW());

INSERT INTO "public"."ItemCategories" ("itemCategoryId", "listId", "listRecSeq", "name", "createdBy", "createdOn", "modifiedOn") VALUES ('5c7e1f9a-8b3d-4d6a-9a0f-2e4c7d5b1f38', 'e4ea1042-bb7b-4d09-85fb-9ab93a507321', 0, 'Party', 'System', NOW(), NOW());

INSERT INTO "public"."ItemCategories" ("itemCategoryId", "listId", "listRecSeq", "name", "createdBy", "createdOn", "modifiedOn") VALUES ('6a9b2e1f-4c7d-4e5a-8f3b-0d1c7e9a5f28', 'e4ea1042-bb7b-4d09-85fb-9ab93a507321', 0, 'Get Together', 'System', NOW(), NOW());

INSERT INTO "public"."ItemCategories" ("itemCategoryId", "listId", "listRecSeq", "name", "createdBy", "createdOn", "modifiedOn") VALUES ('8e1f9a7b-3d4c-4a6e-9b2d-7c0f5e8a3d49', 'e4ea1042-bb7b-4d09-85fb-9ab93a507321', 0, 'Birthday', 'System', NOW(), NOW());

INSERT INTO "public"."ItemCategories" ("itemCategoryId", "listId", "listRecSeq", "name", "createdBy", "createdOn", "modifiedOn") VALUES ('9b2c7f1e-5a4d-4e8c-8c3f-6d0a7e2c5b18', 'e4ea1042-bb7b-4d09-85fb-9ab93a507321', 0, 'Concert', 'System', NOW(), NOW());

INSERT INTO "public"."ItemCategories" ("itemCategoryId", "listId", "listRecSeq", "name", "createdBy", "createdOn", "modifiedOn") VALUES ('1e7a8c9f-3b4d-4e5f-9a2b-6d0c7e1f9a82', 'e4ea1042-bb7b-4d09-85fb-9ab93a507321', 0, 'Show', 'System', NOW(), NOW());

INSERT INTO "public"."ItemCategories" ("itemCategoryId", "listId", "listRecSeq", "name", "createdBy", "createdOn", "modifiedOn") VALUES ('3f9a6b2c-8d5e-4e1f-9b3a-0c7d8e5a4f19', 'e4ea1042-bb7b-4d09-85fb-9ab93a507321', 0, 'Sports Event', 'System', NOW(), NOW());

INSERT INTO "public"."ItemCategories" ("itemCategoryId", "listId", "listRecSeq", "name", "createdBy", "createdOn", "modifiedOn") VALUES ('5b7c1f9e-8d3a-4d6a-9a0f-2e4c7d5b1f38', 'e4ea1042-bb7b-4d09-85fb-9ab93a507321', 0, 'Reunion', 'System', NOW(), NOW());

INSERT INTO "public"."ItemCategories" ("itemCategoryId", "listId", "listRecSeq", "name", "createdBy", "createdOn", "modifiedOn") VALUES ('6c9d2e1f-4b7a-4e5a-8f3b-0d1c7e9a5f28', 'e4ea1042-bb7b-4d09-85fb-9ab93a507321', 0, 'Housewarming', 'System', NOW(), NOW());

INSERT INTO "public"."ItemCategories" ("itemCategoryId", "listId", "listRecSeq", "name", "createdBy", "createdOn", "modifiedOn") VALUES ('7e1f8a9b-3c4d-4a6e-9b2d-7c0f5e8a3d49', 'e4ea1042-bb7b-4d09-85fb-9ab93a507321', 0, 'Graduation', 'System', NOW(), NOW());

INSERT INTO "public"."ItemCategories" ("itemCategoryId", "listId", "listRecSeq", "name", "createdBy", "createdOn", "modifiedOn") VALUES ('ab39b8da-bc1c-4c4a-9d0c-21b66f3dbb3a', 'e4ea1042-bb7b-4d09-85fb-9ab93a507321', 0, 'Wedding', 'System', NOW(), NOW());

INSERT INTO "public"."ItemCategories" ("itemCategoryId", "listId", "listRecSeq", "name", "createdBy", "createdOn", "modifiedOn") VALUES ('f8b9a98a-d211-4708-b6a0-b2e493b4f7cb', 'e4ea1042-bb7b-4d09-85fb-9ab93a507321', 0, 'Other', 'System', NOW(), NOW());

INSERT INTO "public"."Integrations" ("integrationId", "name", "label", "popularity", "createdBy", "createdOn", "modifiedOn") VALUES ('74afba68-8d23-4cd9-8ee7-8deee69e0b78', 'apple_health', 'Apple Health', 0, 'System', NOW(), NOW());

INSERT INTO "public"."Integrations" ("integrationId", "name", "label", "popularity", "createdBy", "createdOn", "modifiedOn") VALUES ('9b50a0a6-429b-4bac-b429-c87af1e9aadb', 'strava', 'Strava', 0, 'System', NOW(), NOW());

INSERT INTO "public"."Integrations" ("integrationId", "name", "label", "popularity", "createdBy", "createdOn", "modifiedOn") VALUES ('4cd446e5-0ef2-4f0c-af9d-1f1f1c8a3076', 'email_scraper', 'Email Scrapping', 0, 'System', NOW(), NOW());

INSERT INTO "public"."Integrations" ("integrationId", "name", "label", "popularity", "createdBy", "createdOn", "modifiedOn") VALUES ('186e0ec9-0deb-44bd-bb27-cd5d173f1a4e', 'plaid', 'Plaid', 0, 'System', NOW(), NOW());

INSERT INTO "public"."Integrations" ("integrationId", "name", "label", "popularity", "createdBy", "createdOn", "modifiedOn") VALUES ('7d895186-3847-4980-84db-5d2bcb3910e1', 'apple_music', 'Apple Music', 0, 'System', NOW(), NOW());

INSERT INTO "public"."Integrations" ("integrationId", "name", "label", "popularity", "createdBy", "createdOn", "modifiedOn") VALUES ('a31c0aea-6970-4e9f-89c9-6701eeb8ae02', 'spotify', 'Spotify', 0, 'System', NOW(), NOW());

INSERT INTO "public"."Integrations" ("integrationId", "name", "label", "popularity", "createdBy", "createdOn", "modifiedOn") VALUES ('8f2c6a12-9b5f-4c61-8b8e-3b2f4d0adba7', 'text_scrapping', 'Text Scrapping', 0, 'System', NOW(), NOW());

INSERT INTO "public"."Integrations" ("integrationId", "name", "label", "popularity", "createdBy", "createdOn", "modifiedOn") VALUES ('2a5e7d54-1e6a-4b2a-9c03-7b67d3ce4b1e', 'contact_list', 'Contact List', 0, 'System', NOW(), NOW());

INSERT INTO "public"."Integrations" ("integrationId", "name", "label", "popularity", "createdBy", "createdOn", "modifiedOn") VALUES ('c7e045b3-12a4-4f3d-a8a9-98b621b0e2a6', 'web_scrapping_goodreads', 'Web Scrapping (goodreads.com)', 0, 'System', NOW(), NOW());

INSERT INTO "public"."ListIntegrationMapping" ("listIntegrationMappingId", "listId", "listRecSeq", "integrationId", "integrationRecSeq", "createdBy", "createdOn", "modifiedOn") VALUES ('ccdfacdd-dffe-45da-9461-27b405dd6090', 'ddb7c814-4c2b-467c-9584-8333b6510c72', 0, '74afba68-8d23-4cd9-8ee7-8deee69e0b78', 0, 'System', NOW(), NOW());

INSERT INTO "public"."ListIntegrationMapping" ("listIntegrationMappingId", "listId", "listRecSeq", "integrationId", "integrationRecSeq", "createdBy", "createdOn", "modifiedOn") VALUES ('5c10906f-6b1b-45dc-b0db-1cbfb4e32542', '61a8ad17-e520-4ef7-9265-6e39aeb8d41a', 0, '74afba68-8d23-4cd9-8ee7-8deee69e0b78', 0, 'System', NOW(), NOW());

INSERT INTO "public"."ListIntegrationMapping" ("listIntegrationMappingId", "listId", "listRecSeq", "integrationId", "integrationRecSeq", "createdBy", "createdOn", "modifiedOn") VALUES ('831a83d2-1a1e-4fb5-b926-de8adbaa272f', '61a8ad17-e520-4ef7-9265-6e39aeb8d41a', 0, '9b50a0a6-429b-4bac-b429-c87af1e9aadb', 0, 'System', NOW(), NOW());

INSERT INTO "public"."ListIntegrationMapping" ("listIntegrationMappingId", "listId", "listRecSeq", "integrationId", "integrationRecSeq", "createdBy", "createdOn", "modifiedOn") VALUES ('f78e8ea0-2664-4031-ac57-447cc3d04e53', 'c8e41c92-af26-469c-82a0-73dc9b9e84eb', 0, '4cd446e5-0ef2-4f0c-af9d-1f1f1c8a3076', 0, 'System', NOW(), NOW());

INSERT INTO "public"."ListIntegrationMapping" ("listIntegrationMappingId", "listId", "listRecSeq", "integrationId", "integrationRecSeq", "createdBy", "createdOn", "modifiedOn") VALUES ('c9697f50-fac4-4355-99bb-07c7005394ab', 'c8e41c92-af26-469c-82a0-73dc9b9e84eb', 0, '186e0ec9-0deb-44bd-bb27-cd5d173f1a4e', 0, 'System', NOW(), NOW());

INSERT INTO "public"."ListIntegrationMapping" ("listIntegrationMappingId", "listId", "listRecSeq", "integrationId", "integrationRecSeq", "createdBy", "createdOn", "modifiedOn") VALUES ('9379d92b-9d0c-4436-9f02-9d7722e82523', '9f9a5a32-f35b-4fe0-9cca-0cf6b0a8c831', 0, '4cd446e5-0ef2-4f0c-af9d-1f1f1c8a3076', 0, 'System', NOW(), NOW());

INSERT INTO "public"."ListIntegrationMapping" ("listIntegrationMappingId", "listId", "listRecSeq", "integrationId", "integrationRecSeq", "createdBy", "createdOn", "modifiedOn") VALUES ('c6fbd092-aaac-4cc5-bda2-1e51d73bc5ad', '9f9a5a32-f35b-4fe0-9cca-0cf6b0a8c831', 0, '186e0ec9-0deb-44bd-bb27-cd5d173f1a4e', 0, 'System', NOW(), NOW());

INSERT INTO "public"."ListIntegrationMapping" ("listIntegrationMappingId", "listId", "listRecSeq", "integrationId", "integrationRecSeq", "createdBy", "createdOn", "modifiedOn") VALUES ('986ef6f3-ffd0-46ad-8f61-afdd6d83f2d1', 'd323558f-a4eb-490a-8a44-3fd5d1863880', 0, '4cd446e5-0ef2-4f0c-af9d-1f1f1c8a3076', 0, 'System', NOW(), NOW());

INSERT INTO "public"."ListIntegrationMapping" ("listIntegrationMappingId", "listId", "listRecSeq", "integrationId", "integrationRecSeq", "createdBy", "createdOn", "modifiedOn") VALUES ('2366d7cc-68f6-4781-b6e4-65d45afa363e', 'd323558f-a4eb-490a-8a44-3fd5d1863880', 0, '186e0ec9-0deb-44bd-bb27-cd5d173f1a4e', 0, 'System', NOW(), NOW());

INSERT INTO "public"."ListIntegrationMapping" ("listIntegrationMappingId", "listId", "listRecSeq", "integrationId", "integrationRecSeq", "createdBy", "createdOn", "modifiedOn") VALUES ('b9586220-e3e4-4cf0-bf5a-50d7890ed562', '3251f2b8-8e65-413c-a2d5-2414e5fcbd1e', 0, '4cd446e5-0ef2-4f0c-af9d-1f1f1c8a3076', 0, 'System', NOW(), NOW());

INSERT INTO "public"."ListIntegrationMapping" ("listIntegrationMappingId", "listId", "listRecSeq", "integrationId", "integrationRecSeq", "createdBy", "createdOn", "modifiedOn") VALUES ('f1b3c5a2-f0f3-4e7c-9e23-4a161f823148', '3251f2b8-8e65-413c-a2d5-2414e5fcbd1e', 0, '186e0ec9-0deb-44bd-bb27-cd5d173f1a4e', 0, 'System', NOW(), NOW());

INSERT INTO "public"."ListIntegrationMapping" ("listIntegrationMappingId", "listId", "listRecSeq", "integrationId", "integrationRecSeq", "createdBy", "createdOn", "modifiedOn") VALUES ('536fda09-0901-46e9-9bd8-c0189338920c', 'c95706fc-d858-4ea3-80e1-990ff0a8c520', 0, '8f2c6a12-9b5f-4c61-8b8e-3b2f4d0adba7', 0, 'System', NOW(), NOW());

INSERT INTO "public"."ListIntegrationMapping" ("listIntegrationMappingId", "listId", "listRecSeq", "integrationId", "integrationRecSeq", "createdBy", "createdOn", "modifiedOn") VALUES ('5a590707-edac-4981-a960-cfd0142afaf1', 'c95706fc-d858-4ea3-80e1-990ff0a8c520', 0, '2a5e7d54-1e6a-4b2a-9c03-7b67d3ce4b1e', 0, 'System', NOW(), NOW());

INSERT INTO "public"."ListIntegrationMapping" ("listIntegrationMappingId", "listId", "listRecSeq", "integrationId", "integrationRecSeq", "createdBy", "createdOn", "modifiedOn") VALUES ('a1b6fe2d-7437-40a1-a82f-b10afb39fa08', 'e4ea1042-bb7b-4d09-85fb-9ab93a507321', 0, '8f2c6a12-9b5f-4c61-8b8e-3b2f4d0adba7', 0, 'System', NOW(), NOW());

INSERT INTO "public"."ListIntegrationMapping" ("listIntegrationMappingId", "listId", "listRecSeq", "integrationId", "integrationRecSeq", "createdBy", "createdOn", "modifiedOn") VALUES ('82ae668c-d471-4952-b0cc-07f58485b4ab', 'e4ea1042-bb7b-4d09-85fb-9ab93a507321', 0, '2a5e7d54-1e6a-4b2a-9c03-7b67d3ce4b1e', 0, 'System', NOW(), NOW());

INSERT INTO "public"."ListIntegrationMapping" ("listIntegrationMappingId", "listId", "listRecSeq", "integrationId", "integrationRecSeq", "createdBy", "createdOn", "modifiedOn") VALUES ('a3114f58-fe11-4b5e-b920-5bcb82c134af', 'fdb2e117-519a-4844-a438-6214313c64fe', 0, '7d895186-3847-4980-84db-5d2bcb3910e1', 0, 'System', NOW(), NOW());

INSERT INTO "public"."ListIntegrationMapping" ("listIntegrationMappingId", "listId", "listRecSeq", "integrationId", "integrationRecSeq", "createdBy", "createdOn", "modifiedOn") VALUES ('f9fee3ad-7d64-4ca1-8a95-da7a324208c5', 'fdb2e117-519a-4844-a438-6214313c64fe', 0, 'a31c0aea-6970-4e9f-89c9-6701eeb8ae02', 0, 'System', NOW(), NOW());

INSERT INTO "public"."ListIntegrationMapping" ("listIntegrationMappingId", "listId", "listRecSeq", "integrationId", "integrationRecSeq", "createdBy", "createdOn", "modifiedOn") VALUES ('b3b1b1f6-f2fc-4f85-a491-2ea4f557e481', 'a946acdb-b303-4b31-bb05-d07274d0a5da', 0, 'c7e045b3-12a4-4f3d-a8a9-98b621b0e2a6', 0, 'System', NOW(), NOW());