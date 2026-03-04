import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import {
  CognitoIdentityProviderClient,
  GetUserCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { createClient } from "@sanity/client";

const s3Client = new S3Client({ region: "us-east-1" });
const cognitoClient = new CognitoIdentityProviderClient({ region: "us-east-1" });

const S3_BUCKET = "thechrisgrey-kb-source";
const S3_KEY = "knowledge-base.txt";

const sanityClient = createClient({
  projectId: "k5950b3w",
  dataset: "production",
  apiVersion: "2024-01-01",
  token: process.env.SANITY_WRITE_TOKEN,
  useCdn: false,
});

const CATEGORY_ORDER = [
  "biography",
  "military",
  "education",
  "career",
  "business",
  "skills",
  "awards",
  "philosophy",
  "podcast",
  "book",
];

const CATEGORY_LABELS = {
  biography: "BIOGRAPHY",
  military: "MILITARY SERVICE",
  education: "EDUCATION",
  career: "CAREER",
  business: "BUSINESS & ENTREPRENEURSHIP",
  skills: "SKILLS & EXPERTISE",
  awards: "AWARDS & RECOGNITION",
  philosophy: "PHILOSOPHY & LEADERSHIP",
  podcast: "THE VECTOR PODCAST",
  book: "BEYOND THE ASSESSMENT",
};

const MAX_TITLE_LENGTH = 200;
const MAX_CONTENT_LENGTH = 50000;
const MAX_DATE_LENGTH = 20;
const MAX_SORT_ORDER = 1000;

function validateEntryFields({ title, category, content, date, sortOrder }, requireAll = false) {
  if (requireAll && (!title || !category || !content)) {
    return "title, category, and content are required";
  }
  if (title !== undefined && (typeof title !== "string" || title.length > MAX_TITLE_LENGTH)) {
    return `title must be a string of at most ${MAX_TITLE_LENGTH} characters`;
  }
  if (category !== undefined && !CATEGORY_ORDER.includes(category)) {
    return `category must be one of: ${CATEGORY_ORDER.join(", ")}`;
  }
  if (content !== undefined && (typeof content !== "string" || content.length > MAX_CONTENT_LENGTH)) {
    return `content must be a string of at most ${MAX_CONTENT_LENGTH} characters`;
  }
  if (date !== undefined && date !== null && (typeof date !== "string" || date.length > MAX_DATE_LENGTH || isNaN(Date.parse(date)))) {
    return "date must be a valid date string";
  }
  if (sortOrder !== undefined && sortOrder !== null && (typeof sortOrder !== "number" || sortOrder < 0 || sortOrder > MAX_SORT_ORDER)) {
    return `sortOrder must be a number between 0 and ${MAX_SORT_ORDER}`;
  }
  return null;
}

async function validateToken(authHeader) {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.slice(7);

  try {
    const command = new GetUserCommand({ AccessToken: token });
    const response = await cognitoClient.send(command);
    return response;
  } catch (error) {
    console.error("Token validation failed:", error.name);
    return null;
  }
}

async function fetchEntries(activeOnly = false) {
  const filter = activeOnly
    ? '*[_type == "kbEntry" && isActive == true]'
    : '*[_type == "kbEntry"]';

  return sanityClient.fetch(
    `${filter} | order(category asc, sortOrder asc, date desc) {
      _id, _createdAt, _updatedAt, title, category, content, date, sortOrder, isActive
    }`
  );
}

function assembleDocument(entries) {
  const grouped = {};

  for (const entry of entries) {
    const cat = entry.category || "biography";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(entry);
  }

  const sections = [];

  for (const category of CATEGORY_ORDER) {
    const items = grouped[category];
    if (!items || items.length === 0) continue;

    const label = CATEGORY_LABELS[category] || category.toUpperCase();
    const lines = [`=== ${label} ===`, ""];

    for (const item of items) {
      const dateStr = item.date
        ? ` (${new Date(item.date).toLocaleDateString("en-US", { year: "numeric", month: "long" })})`
        : "";
      lines.push(`${item.title}${dateStr}`);
      lines.push(item.content);
      lines.push("");
    }

    sections.push(lines.join("\n"));
  }

  for (const [category, items] of Object.entries(grouped)) {
    if (CATEGORY_ORDER.includes(category)) continue;
    const label = category.toUpperCase();
    const lines = [`=== ${label} ===`, ""];
    for (const item of items) {
      lines.push(item.title);
      lines.push(item.content);
      lines.push("");
    }
    sections.push(lines.join("\n"));
  }

  return sections.join("\n\n");
}

async function uploadToS3(document) {
  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: S3_KEY,
    Body: document,
    ContentType: "text/plain; charset=utf-8",
  });
  return s3Client.send(command);
}

function respond(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "https://thechrisgrey.com",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    },
    body: JSON.stringify(body),
  };
}

export const handler = async (event) => {
  if (event.requestContext?.http?.method === "OPTIONS") {
    return respond(200, { ok: true });
  }

  const authHeader = event.headers?.authorization || event.headers?.Authorization;
  const user = await validateToken(authHeader);
  if (!user) {
    return respond(401, { error: "Unauthorized" });
  }

  const method = event.requestContext?.http?.method;
  const path = event.rawPath || "";

  try {
    if (method === "GET" && path === "/entries") {
      const entries = await fetchEntries(false);
      return respond(200, { entries });
    }

    if (method === "POST" && path === "/entries") {
      const body = JSON.parse(event.body || "{}");
      const { title, category, content, date, sortOrder, isActive } = body;

      const validationError = validateEntryFields({ title, category, content, date, sortOrder }, true);
      if (validationError) {
        return respond(400, { error: validationError });
      }

      const doc = {
        _type: "kbEntry",
        title,
        category,
        content,
        date: date || undefined,
        sortOrder: sortOrder ?? undefined,
        isActive: isActive !== false,
      };

      const result = await sanityClient.create(doc);
      return respond(201, { entry: result });
    }

    if (method === "PUT" && path.startsWith("/entries/")) {
      const id = path.split("/entries/")[1];
      if (!id) return respond(400, { error: "Missing entry ID" });
      if (!/^[a-zA-Z0-9._-]+$/.test(id)) {
        return respond(400, { error: "Invalid entry ID format" });
      }

      const body = JSON.parse(event.body || "{}");

      const validationError = validateEntryFields(body, false);
      if (validationError) {
        return respond(400, { error: validationError });
      }

      const patch = sanityClient.patch(id);

      if (body.title !== undefined) patch.set({ title: body.title });
      if (body.category !== undefined) patch.set({ category: body.category });
      if (body.content !== undefined) patch.set({ content: body.content });
      if (body.date !== undefined) patch.set({ date: body.date });
      if (body.sortOrder !== undefined) patch.set({ sortOrder: body.sortOrder });
      if (body.isActive !== undefined) patch.set({ isActive: body.isActive });

      const result = await patch.commit();
      return respond(200, { entry: result });
    }

    if (method === "DELETE" && path.startsWith("/entries/")) {
      const id = path.split("/entries/")[1];
      if (!id) return respond(400, { error: "Missing entry ID" });
      if (!/^[a-zA-Z0-9._-]+$/.test(id)) {
        return respond(400, { error: "Invalid entry ID format" });
      }

      // Verify document is a kbEntry before deleting
      const doc = await sanityClient.getDocument(id);
      if (!doc) return respond(404, { error: "Entry not found" });
      if (doc._type !== "kbEntry") {
        return respond(403, { error: "Cannot delete non-kbEntry documents" });
      }

      await sanityClient.delete(id);
      return respond(200, { deleted: true });
    }

    if (method === "POST" && path === "/publish") {
      const entries = await fetchEntries(true);

      if (entries.length === 0) {
        return respond(400, { error: "No active entries to publish" });
      }

      const document = assembleDocument(entries);
      await uploadToS3(document);

      return respond(200, {
        message: "Knowledge Base document published",
        entryCount: entries.length,
        documentSize: document.length,
        publishedAt: new Date().toISOString(),
      });
    }

    return respond(404, { error: "Not found" });
  } catch (error) {
    console.error("Handler error:", error);
    return respond(500, { error: "Internal server error" });
  }
};
