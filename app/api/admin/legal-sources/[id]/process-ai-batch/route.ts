import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export const runtime = 'nodejs';

const AR = {
  article: '\u0627\u0644\u0645\u0627\u062f\u0629',
  articleText: '\u0646\u0635 \u0627\u0644\u0645\u0627\u062f\u0629',
  from: '\u0645\u0646',
  thisLaw: '\u0647\u0630\u0627 \u0627\u0644\u0642\u0627\u0646\u0648\u0646',
  articleNumber: '\u0627\u0644\u0645\u0627\u062f\u0629 \u0631\u0642\u0645',
  paragraphNumber: '\u0627\u0644\u0641\u0642\u0631\u0629 \u0631\u0642\u0645',
  number: '\u0631\u0642\u0645',
  jordan1: '\u0627\u0644\u0623\u0631\u062f\u0646',
  jordan2: '\u0627\u0644\u0627\u0631\u062f\u0646',
  jordanAdjective: '\u0627\u0644\u0623\u0631\u062f\u0646\u064a',
  civilProcedureTitle: '\u0642\u0627\u0646\u0648\u0646 \u0623\u0635\u0648\u0644 \u0627\u0644\u0645\u062d\u0627\u0643\u0645\u0627\u062a \u0627\u0644\u0645\u062f\u0646\u064a\u0629 \u0627\u0644\u0623\u0631\u062f\u0646\u064a',
};

function normalizeArticleNumber(value: string): string {
  return value.replace(/[^\d]/g, '').trim();
}

function normalizeText(value: string): string {
  return value.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function cleanArticleTextForDisplay(value: string): string {
  const articleWord = AR.article;
  const fromWord = AR.from;
  const thisLaw = AR.thisLaw;

  return value
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/[（]/g, '(')
    .replace(/[）]/g, ')')
    .replace(/[ \t]+/g, ' ')

    // 3( ) من المادة 123( ) => الفقرة رقم 3 من المادة رقم 123
    .replace(
      new RegExp(`(\\d+)\\s*\\(\\s*\\)\\s+${fromWord}\\s+${articleWord}\\s+(\\d+)\\s*\\(\\s*\\)`, 'g'),
      (_match, paragraphNumber: string, articleNumber: string) =>
        `${AR.paragraphNumber} ${paragraphNumber} ${AR.from} ${AR.articleNumber} ${articleNumber}`
    )

    // 3( من المادة 123( => الفقرة رقم 3 من المادة رقم 123
    .replace(
      new RegExp(`(\\d+)\\s*\\(\\s+${fromWord}\\s+${articleWord}\\s+(\\d+)\\s*\\(`, 'g'),
      (_match, paragraphNumber: string, articleNumber: string) =>
        `${AR.paragraphNumber} ${paragraphNumber} ${AR.from} ${AR.articleNumber} ${articleNumber}`
    )

    // 3( ) من المادة 123 => الفقرة رقم 3 من المادة رقم 123
    .replace(
      new RegExp(`(\\d+)\\s*\\(\\s*\\)\\s+${fromWord}\\s+${articleWord}\\s+(\\d+)`, 'g'),
      (_match, paragraphNumber: string, articleNumber: string) =>
        `${AR.paragraphNumber} ${paragraphNumber} ${AR.from} ${AR.articleNumber} ${articleNumber}`
    )

    // 3( ) من المادة => الفقرة رقم 3 من المادة
    .replace(
      new RegExp(`(\\d+)\\s*\\(\\s*\\)\\s+${fromWord}\\s+${articleWord}`, 'g'),
      (_match, paragraphNumber: string) =>
        `${AR.paragraphNumber} ${paragraphNumber} ${AR.from} ${articleWord}`
    )

    // المادة 170( ) / المادة 170() / المادة 170( => المادة رقم 170
    .replace(
      new RegExp(`${articleWord}\\s+(\\d+)\\s*\\(\\s*\\)`, 'g'),
      (_match, articleNumber: string) => `${AR.articleNumber} ${articleNumber}`
    )
    .replace(
      new RegExp(`${articleWord}\\s+(\\d+)\\s*\\(`, 'g'),
      (_match, articleNumber: string) => `${AR.articleNumber} ${articleNumber}`
    )

    // 12() من هذا القانون => المادة رقم 12 من هذا القانون
    .replace(
      new RegExp(`(\\d+)\\s*\\(\\s*\\)\\s+${fromWord}\\s+${thisLaw}`, 'g'),
      (_match, articleNumber: string) => `${AR.articleNumber} ${articleNumber} ${AR.from} ${thisLaw}`
    )
    .replace(
      new RegExp(`(\\d+)\\s*\\(\\s+${fromWord}\\s+${thisLaw}`, 'g'),
      (_match, articleNumber: string) => `${AR.articleNumber} ${articleNumber} ${AR.from} ${thisLaw}`
    )

    // بداية السطر: 2( النص أو 2) النص أو 2( ) النص => 2. النص
    .replace(/^\s*(\d+)\s*\(\s*\)\s*/gm, '$1. ')
    .replace(/^\s*(\d+)\s*\(\s*/gm, '$1. ')
    .replace(/^\s*(\d+)\s*\)\s*/gm, '$1. ')

    // أي رقم متبقٍ بهذا الشكل 123( ) / 123() / 123( => رقم 123
    .replace(/(\d+)\s*\(\s*\)/g, (_match, number: string) => `${AR.number} ${number}`)
    .replace(/(\d+)\s*\(/g, (_match, number: string) => `${AR.number} ${number}`)

    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\s*-\s*(\d+)\s*[-–]\s*/gm, '$1. ')
    .replace(/^\s*-\s*(\d+)(?=[\u0600-\u06FF])/gm, '$1. ')
    .replace(/^\s*(\d+)(?=[\u0600-\u06FF])/gm, '$1. ')
    .replace(/(\d+)(?=[\u0600-\u06FF])/g, '$1 ')
    .replace(/\s+([،.:؛])/g, '$1')
    .replace(/([،.:؛])([^\s\n])/g, '$1 $2')
    .trim();
}

function extractArticleText(fileContent: string, articleNumber: string): string {
  const normalizedContent = normalizeText(fileContent);
  const safeArticleNumber = normalizeArticleNumber(articleNumber);

  if (!safeArticleNumber) return '';

  const startPattern = new RegExp(
    `(^|\\n)\\s*#{1,6}\\s*${AR.article}\\s+${safeArticleNumber}\\s*(?=\\n)`,
    'm'
  );

  const startMatch = normalizedContent.match(startPattern);

  if (!startMatch || startMatch.index === undefined) {
    return '';
  }

  const startIndex =
    startMatch.index + (startMatch[1] ? startMatch[1].length : 0);

  const remainingText = normalizedContent.slice(startIndex);

  const nextArticlePattern = new RegExp(
    `\\n\\s*#{1,6}\\s*${AR.article}\\s+\\d+\\s*(?=\\n)`,
    'm'
  );

  const nextMatch = remainingText.slice(1).match(nextArticlePattern);

  const articleBlock =
    nextMatch?.index !== undefined
      ? remainingText.slice(0, nextMatch.index + 1)
      : remainingText;

  const textSectionPattern = new RegExp(`${AR.articleText}\\s*:\\s*([\\s\\S]*)`);
  const textSectionMatch = articleBlock.match(textSectionPattern);

  const cleanedText = textSectionMatch?.[1]
    ? textSectionMatch[1]
    : articleBlock;

  return cleanArticleTextForDisplay(
    cleanedText.replace(/\n---\s*$/g, '').trim()
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      country?: string;
      sourceTitle?: string;
      articleNumber?: string;
    };

    const articleNumber = normalizeArticleNumber(
      String(body.articleNumber || '')
    );

    if (!articleNumber) {
      return NextResponse.json(
        { error: '\u0631\u0642\u0645 \u0627\u0644\u0645\u0627\u062f\u0629 \u0645\u0637\u0644\u0648\u0628.' },
        { status: 400 }
      );
    }

    const country = String(body.country || '').trim();
    const sourceTitle = String(body.sourceTitle || '').trim();

    const isJordan =
      country === AR.jordan1 ||
      country === AR.jordan2 ||
      country.toLowerCase() === 'jordan' ||
      sourceTitle.includes(AR.jordanAdjective) ||
      sourceTitle.includes(AR.jordan1);

    if (!isJordan) {
      return NextResponse.json(
        { error: '\u0647\u0630\u0627 \u0627\u0644\u0645\u0635\u062f\u0631 \u0627\u0644\u0642\u0627\u0646\u0648\u0646\u064a \u063a\u064a\u0631 \u0645\u062f\u0639\u0648\u0645 \u062d\u0627\u0644\u064a\u0627.' },
        { status: 400 }
      );
    }

    const filePath = path.join(
      process.cwd(),
      'legal-sources',
      'jordan',
      'Jordan_Civil_Procedure_Law_RAG.md'
    );

    let fileContent = '';

    try {
      fileContent = await fs.readFile(filePath, 'utf8');
    } catch {
      return NextResponse.json(
        {
          error:
            'Legal source file was not found. Make sure legal-sources/jordan/Jordan_Civil_Procedure_Law_RAG.md exists.',
        },
        { status: 404 }
      );
    }

    const articleText = extractArticleText(fileContent, articleNumber);

    if (!articleText) {
      return NextResponse.json(
        {
          error: `Article ${articleNumber} was not found in the current legal source file.`,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      articleNumber,
      sourceTitle: sourceTitle || AR.civilProcedureTitle,
      articleText,
    });
  } catch (error) {
    console.error('Legal article lookup error:', error);

    return NextResponse.json(
      { error: '\u062d\u062f\u062b \u062e\u0637\u0623 \u0623\u062b\u0646\u0627\u0621 \u062c\u0644\u0628 \u0646\u0635 \u0627\u0644\u0645\u0627\u062f\u0629 \u0627\u0644\u0642\u0627\u0646\u0648\u0646\u064a\u0629.' },
      { status: 500 }
    );
  }
}
