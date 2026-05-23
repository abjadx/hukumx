import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const filePath = path.join(
  process.cwd(),
  'legal-sources',
  'jordan',
  'Jordan_Civil_Procedure_Law_RAG.md'
);

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is missing');
  }

  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  console.log('Creating vector store...');

  const vectorStore = await openai.vectorStores.create({
    name: 'hukumx-jordan-laws',
  });

  console.log('Vector Store created:');
  console.log(vectorStore.id);

  console.log('Uploading law file...');

  const file = await openai.files.create({
    file: fs.createReadStream(filePath),
    purpose: 'assistants',
  });

  console.log('File uploaded:');
  console.log(file.id);

  console.log('Adding file to vector store...');

  await openai.vectorStores.files.create(vectorStore.id, {
    file_id: file.id,
  });

  console.log('Waiting for file processing...');

  let completed = false;

  while (!completed) {
    const files = await openai.vectorStores.files.list(vectorStore.id);

    const currentFile = files.data.find((item) => item.id === file.id);

    console.log('Current status:', currentFile?.status);

    if (currentFile?.status === 'completed') {
      completed = true;
      break;
    }

    if (currentFile?.status === 'failed') {
      throw new Error('File processing failed');
    }

    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  console.log('');
  console.log('DONE');
  console.log('Add this to .env.local and Railway Variables:');
  console.log(`OPENAI_VECTOR_STORE_JORDAN_LAWS=${vectorStore.id}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});