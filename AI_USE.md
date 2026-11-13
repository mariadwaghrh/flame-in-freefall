# Use of SI (AI) tools

The Space Apps rules require every project to say where and how SI tools were used. This file is kept up to date during the hackathon.

## Development
- **Claude (Anthropic), through Claude Code**: used as a coding assistant to write and debug the code in this repository, step by step with the team. Code it generated was reviewed and run by the team before each commit.
- Team research: test questions in `data/curated/eval_questions.json` and lesson quotes in `data/curated/applications.json` were written by team members from the challenge resources; every quote is checked word for word by the code.
- Hand-written Arabic descriptions and translations in `data/curated/` were drafted with Claude and checked by the team against the NASA PSI records they describe.

## Inside the running app
- **Llama 3.2 3B** (Meta, through Ollama, running locally): drafts answers and summaries from retrieved NASA passages only.
- **bge-m3** (BAAI, through Ollama, running locally): text embeddings for search and for the answer check.
- Every generated answer is checked sentence by sentence against the NASA evidence before it is shown; unsupported sentences are removed and labelled.

## Not used
- No SI-generated images or videos. All images and videos in the app are real NASA PSI files.
- No NASA logos or branding in generated content.
