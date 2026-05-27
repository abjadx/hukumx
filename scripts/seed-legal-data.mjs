import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

function loadEnvFile() {
  const envPath = path.join(process.cwd(), '.env');

  if (!fs.existsSync(envPath)) {
    throw new Error('.env file was not found');
  }

  const envContent = fs.readFileSync(envPath, 'utf8');

  for (const line of envContent.split('\n')) {
    const trimmedLine = line.trim();

    if (!trimmedLine || trimmedLine.startsWith('#')) continue;

    const equalIndex = trimmedLine.indexOf('=');
    if (equalIndex === -1) continue;

    const key = trimmedLine.slice(0, equalIndex).trim();
    let value = trimmedLine.slice(equalIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function cleanText(value) {
  return value
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/[（]/g, '(')
    .replace(/[）]/g, ')')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\s*\.(\d+)(?=[\u0600-\u06FF])/gm, '$1. ')
    .replace(/^\s*\)\s*(\d+)(?=[\u0600-\u06FF])/gm, '$1. ')
    .replace(/^\s*(\d+)(?=[\u0600-\u06FF])/gm, '$1. ')
    .replace(/(\d+)(?=[\u0600-\u06FF])/g, '$1 ')
    .replace(/\s+([،.:؛])/g, '$1')
    .replace(/([،.:؛])([^\s\n])/g, '$1 $2')
    .trim();
}

function extractArticles(fileContent) {
  const matches = [...fileContent.matchAll(/^##\s+المادة\s+(\d+)\s*$/gm)];
  const articles = [];

  for (let i = 0; i < matches.length; i++) {
    const currentMatch = matches[i];
    const nextMatch = matches[i + 1];

    const articleNumber = currentMatch[1];
    const startIndex = currentMatch.index;
    const endIndex = nextMatch ? nextMatch.index : fileContent.length;

    const articleBlock = fileContent.slice(startIndex, endIndex);

    const textMatch = articleBlock.match(/نص المادة:\s*\n([\s\S]*)/);

    if (!textMatch) continue;

    const articleText = textMatch[1]
      .replace(/\n---\s*$/g, '')
      .trim();

    if (!articleText) continue;

    articles.push({
      articleNumber,
      articleText,
      articleTextClean: cleanText(articleText),
    });
  }

  return articles;
}

loadEnvFile();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not defined in .env');
}

const adapter = new PrismaPg({
  connectionString,
});

const prisma = new PrismaClient({
  adapter,
});

async function main() {
  const filePath = path.join(
    process.cwd(),
    'legal-sources',
    'jordan',
    'Jordan_Civil_Procedure_Law_RAG.md'
  );

  if (!fs.existsSync(filePath)) {
    throw new Error(`Legal source file not found: ${filePath}`);
  }

  const fileContent = fs.readFileSync(filePath, 'utf8');
  const articles = extractArticles(fileContent);

  if (articles.length === 0) {
    throw new Error('No articles were extracted from the legal source file');
  }

  const country = await prisma.country.upsert({
    where: { code: 'JO' },
    update: {
      nameAr: 'الأردن',
      nameEn: 'Jordan',
    },
    create: {
      code: 'JO',
      nameAr: 'الأردن',
      nameEn: 'Jordan',
    },
  });

  const legalSource = await prisma.legalSource.upsert({
    where: { slug: 'jordan-civil-procedure-law' },
    update: {
      countryId: country.id,
      titleAr: 'قانون أصول المحاكمات المدنية الأردني',
      titleEn: 'Jordan Civil Procedure Law',
      category: 'civil_procedure',
      fileName: 'Jordan_Civil_Procedure_Law_RAG.md',
      isActive: true,
    },
    create: {
      countryId: country.id,
      titleAr: 'قانون أصول المحاكمات المدنية الأردني',
      titleEn: 'Jordan Civil Procedure Law',
      slug: 'jordan-civil-procedure-law',
      category: 'civil_procedure',
      fileName: 'Jordan_Civil_Procedure_Law_RAG.md',
      isActive: true,
    },
  });

  for (const article of articles) {
    await prisma.legalArticle.upsert({
      where: {
        legalSourceId_articleNumber: {
          legalSourceId: legalSource.id,
          articleNumber: article.articleNumber,
        },
      },
      update: {
        articleText: article.articleText,
        articleTextClean: article.articleTextClean,
      },
      create: {
        legalSourceId: legalSource.id,
        articleNumber: article.articleNumber,
        articleText: article.articleText,
        articleTextClean: article.articleTextClean,
      },
    });
  }

  console.log(`✅ Seed completed successfully`);
  console.log(`✅ Country: ${country.nameAr}`);
  console.log(`✅ Legal source: ${legalSource.titleAr}`);
  console.log(`✅ Articles inserted/updated: ${articles.length}`);
}

main()
  .catch((error) => {
    console.error('❌ Seed failed');
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });