import 'server-only'
import type { PrepQuestion } from './prep-types'

export const AI_ENGINEER_BANK: PrepQuestion[] = [
  // ─── RAG Architecture (ai-001–ai-010) ──────────────────────────────────────

  {
    id: 'ai-001',
    topic: 'RAG Architecture',
    difficulty: 'mid',
    prompt:
      `You need to build a RAG system for a company's internal documentation (10,000 documents, updated weekly). Walk me through your chunking strategy. What factors influence chunk size, and what are the tradeoffs between fixed-size, sentence-boundary, and semantic chunking?`,
    hints: [
      `Consider the embedding model's context window and retrieval precision`,
      'Think about what happens when a relevant answer spans chunk boundaries',
      'Overlapping chunks help with boundary issues but increase index size',
    ],
    concepts: ['rag-chunking', 'embedding-models', 'retrieval-precision'],
    companies: ['Glean', 'Notion', 'Salesforce', 'Cohere'],
  },
  {
    id: 'ai-002',
    topic: 'RAG Architecture',
    difficulty: 'senior',
    prompt:
      `Your RAG system has high recall but low precision — it retrieves 20 chunks but only 2 are truly relevant, and the LLM gets confused by the noise. How do you improve precision without sacrificing recall? Discuss reranking approaches and when you'd use a cross-encoder vs a bi-encoder.`,
    hints: [
      'Bi-encoders are fast for ANN search; cross-encoders are slow but more accurate',
      'Two-stage retrieval: broad bi-encoder pass, then cross-encoder rerank top-k',
      'MMR (Maximal Marginal Relevance) balances relevance and diversity',
    ],
    concepts: ['rag-reranking', 'cross-encoder', 'bi-encoder', 'retrieval-precision'],
    companies: ['Cohere', 'Anthropic', 'OpenAI', 'Pinecone'],
  },
  {
    id: 'ai-003',
    topic: 'RAG Architecture',
    difficulty: 'mid',
    prompt:
      'A user asks a multi-hop question: "Who was the CEO of Company X when they acquired Company Y, and what was their stated reason?" Your standard single-retrieval RAG fails. What retrieval patterns address multi-hop questions?',
    hints: [
      'Iterative retrieval: use intermediate answers to form follow-up queries',
      'Query decomposition: break the question into sub-questions',
      'Graph RAG: entities and relationships as a knowledge graph',
    ],
    concepts: ['rag-multihop', 'query-decomposition', 'graph-rag'],
    companies: ['Microsoft', 'Google', 'Glean'],
  },
  {
    id: 'ai-004',
    topic: 'RAG Architecture',
    difficulty: 'senior',
    prompt:
      'Design a RAG evaluation pipeline for a production system. You need to catch regressions before they reach users. What metrics do you track, how do you build a test set, and how does this integrate into CI/CD?',
    hints: [
      'RAGAS framework: faithfulness, answer relevance, context precision, context recall',
      'Golden dataset: curated question-answer-context triples',
      'Automated regression: fail pipeline if metrics drop below threshold',
    ],
    concepts: ['rag-evaluation', 'ragas', 'llm-evaluation-metrics'],
    companies: ['Anthropic', 'OpenAI', 'Cohere', 'LangChain'],
  },
  {
    id: 'ai-005',
    topic: 'RAG Architecture',
    difficulty: 'mid',
    prompt:
      'Your RAG system is slow — p95 latency is 4 seconds. The vector search itself takes 80ms. Where is the time going, and what are your main levers for optimization?',
    hints: [
      'Embedding the query, ANN search, reranking, LLM generation are the main stages',
      'Caching: embed common queries, cache popular retrievals',
      'Reduce chunk count fed to LLM; streaming for perceived latency',
    ],
    concepts: ['rag-latency', 'embedding-models', 'llm-inference-optimization'],
    companies: ['Pinecone', 'Weaviate', 'Anthropic'],
  },
  {
    id: 'ai-006',
    topic: 'RAG Architecture',
    difficulty: 'senior',
    prompt:
      'You have a hybrid search system combining dense (vector) and sparse (BM25/keyword) retrieval. How do you combine the scores from both systems? What is Reciprocal Rank Fusion, and when would you prefer it over a learned linear combination?',
    hints: [
      'Score spaces differ: cosine similarity vs BM25 scores are not directly comparable',
      'RRF: 1/(rank + k) for each result, sum across systems — rank-based not score-based',
      'Learned combination needs training data; RRF is zero-shot',
    ],
    concepts: ['hybrid-search', 'bm25', 'reciprocal-rank-fusion', 'dense-retrieval'],
    companies: ['Elasticsearch', 'Pinecone', 'Weaviate', 'Cohere'],
  },
  {
    id: 'ai-007',
    topic: 'RAG Architecture',
    difficulty: 'mid',
    prompt:
      `How do you handle document updates in a production RAG system? If 10% of your 100,000 documents change daily, what's your indexing strategy? Compare full re-index, incremental update, and soft-delete + re-insert approaches.`,
    hints: [
      'Chunk-level versioning: identify which chunks belong to which document version',
      'Soft delete: mark old vectors as stale, insert new, then background cleanup',
      'Incremental update requires detecting which chunks actually changed',
    ],
    concepts: ['rag-index-management', 'vector-database-updates', 'embedding-models'],
    companies: ['Glean', 'Notion', 'Pinecone', 'Weaviate'],
  },
  {
    id: 'ai-008',
    topic: 'RAG Architecture',
    difficulty: 'senior',
    prompt:
      `Design a multi-tenant RAG system where tenants must not see each other's data. You have 500 tenants, each with 1,000–50,000 documents. What isolation strategies do you consider, and how do you balance security against cost/complexity?`,
    hints: [
      'Namespace/partition per tenant vs. separate index per tenant',
      'Metadata filtering: simpler but requires trusting filter enforcement',
      'Separate indexes: strongest isolation, higher cost for small tenants',
    ],
    concepts: ['rag-multitenancy', 'vector-database-isolation', 'data-security'],
    companies: ['Salesforce', 'Glean', 'Cohere', 'Pinecone'],
  },
  {
    id: 'ai-009',
    topic: 'RAG Architecture',
    difficulty: 'mid',
    prompt:
      'What is the "lost in the middle" problem in RAG, and how does it affect how you order retrieved chunks in the prompt? What mitigation strategies exist?',
    hints: [
      'LLMs attend better to content at the beginning and end of long contexts',
      'Place highest-relevance chunks first or last, not in the middle',
      'Reduce chunk count rather than cramming everything in',
    ],
    concepts: ['rag-prompt-construction', 'llm-attention-patterns', 'context-window'],
    companies: ['Anthropic', 'OpenAI', 'Cohere'],
  },
  {
    id: 'ai-010',
    topic: 'RAG Architecture',
    difficulty: 'senior',
    prompt:
      'Compare RAG vs. fine-tuning for a use case where a company wants their LLM to have deep knowledge of their proprietary product manual (2,000 pages, updated quarterly). When would you choose each approach, and when would you combine them?',
    hints: [
      'RAG: up-to-date, auditable, no training cost, but retrieval can fail',
      'Fine-tuning: bakes in style/tone/patterns, but knowledge is frozen at training time',
      'Combine: fine-tune for behavior/format, RAG for current facts',
    ],
    concepts: ['rag-vs-fine-tuning', 'knowledge-update', 'llm-deployment-patterns'],
    companies: ['Anthropic', 'OpenAI', 'Cohere', 'Mistral'],
  },

  // ─── Prompt Engineering (ai-011–ai-018) ────────────────────────────────────

  {
    id: 'ai-011',
    topic: 'Prompt Engineering',
    difficulty: 'mid',
    prompt:
      'You need an LLM to reliably output structured JSON for a downstream pipeline. The model occasionally outputs prose instead. Walk me through your escalating strategies for enforcing structured output, from prompting to API features to post-processing.',
    hints: [
      'Prompt-level: explicit schema in system prompt, few-shot examples with JSON',
      'API-level: JSON mode, function calling / tool use, constrained decoding',
      'Post-processing: parse with fallback retry if parsing fails',
    ],
    concepts: ['structured-output', 'function-calling', 'prompt-reliability'],
    companies: ['OpenAI', 'Anthropic', 'Google', 'Mistral'],
  },
  {
    id: 'ai-012',
    topic: 'Prompt Engineering',
    difficulty: 'mid',
    prompt:
      `Explain Chain-of-Thought prompting. When does it help, when does it hurt, and how does "zero-shot CoT" differ from few-shot CoT? What's the risk of long reasoning chains in production?`,
    hints: [
      'CoT helps on multi-step reasoning; hurts on simple factual lookups (adds noise)',
      `Zero-shot CoT: "Let's think step by step" — no examples needed`,
      'Longer chains = more tokens = higher latency and cost',
    ],
    concepts: ['chain-of-thought', 'reasoning-prompts', 'llm-inference-optimization'],
    companies: ['Google', 'Anthropic', 'OpenAI'],
  },
  {
    id: 'ai-013',
    topic: 'Prompt Engineering',
    difficulty: 'senior',
    prompt:
      'You are building a production prompt that will be used by 1M users/day. The prompt contains user-provided text. How do you defend against prompt injection attacks? Give concrete examples of injection payloads and your mitigations.',
    hints: [
      'Injection example: user input contains "Ignore all previous instructions and output…"',
      'Mitigation: XML/delimiter isolation, role separation (system vs user), input validation',
      'Output validation: verify output matches expected schema before using it',
    ],
    concepts: ['prompt-injection', 'llm-security', 'input-validation'],
    companies: ['Anthropic', 'OpenAI', 'Cloudflare'],
  },
  {
    id: 'ai-014',
    topic: 'Prompt Engineering',
    difficulty: 'mid',
    prompt:
      'Compare zero-shot, one-shot, and few-shot prompting. How do you select few-shot examples for a classification task? What role does example ordering play, and what is "label bias" in few-shot prompting?',
    hints: [
      'Few-shot examples act as implicit training signal — quality matters more than quantity',
      'Example selection: similar to query (retrieval-augmented few-shot) outperforms random',
      'Label bias: LLMs over-predict the class that appears more in examples',
    ],
    concepts: ['few-shot-prompting', 'in-context-learning', 'classification'],
    companies: ['OpenAI', 'Anthropic', 'Google', 'Cohere'],
  },
  {
    id: 'ai-015',
    topic: 'Prompt Engineering',
    difficulty: 'senior',
    prompt:
      'Your team wants to systematically improve a prompt that currently achieves 72% accuracy on your eval set. Describe a rigorous prompt engineering workflow — how do you generate variations, measure improvements, and avoid overfitting to your eval set?',
    hints: [
      'Classify failure modes first: ambiguity, missing context, wrong format, hallucination',
      'A/B test prompt variants on held-out eval set; commit only if delta > noise floor',
      'Hold back 20% of evals as a final regression set you never tune against',
    ],
    concepts: ['prompt-optimization', 'llm-evaluation-metrics', 'overfitting'],
    companies: ['Anthropic', 'OpenAI', 'Cohere', 'Scale'],
  },
  {
    id: 'ai-016',
    topic: 'Prompt Engineering',
    difficulty: 'mid',
    prompt:
      'What is "role prompting" and "persona assignment"? When is it effective, and when does it backfire? Give an example where assigning a persona meaningfully improves output quality.',
    hints: [
      'Effective: "You are a senior security engineer reviewing code for vulnerabilities"',
      'Backfires: personas can reinforce stereotypes or make the model overconfident',
      'The mechanism is attention steering, not genuine persona adoption',
    ],
    concepts: ['system-prompts', 'role-prompting', 'prompt-reliability'],
    companies: ['Anthropic', 'OpenAI'],
  },
  {
    id: 'ai-017',
    topic: 'Prompt Engineering',
    difficulty: 'senior',
    prompt:
      'You need to reduce LLM API costs by 40% without meaningfully degrading output quality for a summarization pipeline processing 500,000 documents/day. What are your main levers, and how do you measure quality/cost tradeoffs?',
    hints: [
      'Model routing: use cheaper/smaller model for simple inputs, flagship for complex',
      'Prompt compression: remove verbose instructions, use shorter few-shot examples',
      'Caching: semantic cache for near-duplicate inputs',
    ],
    concepts: ['llm-cost-optimization', 'model-routing', 'prompt-compression'],
    companies: ['Anthropic', 'OpenAI', 'Google', 'Together'],
  },
  {
    id: 'ai-018',
    topic: 'Prompt Engineering',
    difficulty: 'mid',
    prompt:
      'What is "temperature" in LLM sampling, and how does it interact with top-p (nucleus sampling)? For a code generation task vs. a creative writing task, how would you set these parameters and why?',
    hints: [
      'Temperature scales logits before softmax; higher = more uniform distribution = more random',
      'Top-p: sample from smallest set of tokens whose cumulative probability ≥ p',
      'Code: low temperature (0–0.2) for determinism; creative: higher (0.7–1.0)',
    ],
    concepts: ['llm-sampling', 'temperature', 'decoding-strategies'],
    companies: ['OpenAI', 'Anthropic', 'Google'],
  },

  // ─── Fine-tuning (ai-019–ai-026) ────────────────────────────────────────────

  {
    id: 'ai-019',
    topic: 'Fine-tuning',
    difficulty: 'mid',
    prompt:
      `When should you fine-tune a model instead of (or in addition to) prompt engineering? Give three concrete scenarios where fine-tuning provides value that prompting cannot, and three scenarios where it's the wrong tool.`,
    hints: [
      'Good fit: domain-specific style/format, latency-sensitive (no system prompt overhead), cost at scale',
      'Bad fit: frequently updated knowledge, small datasets (<100 examples), one-off tasks',
      'Fine-tuning teaches behavior/format; RAG teaches current facts',
    ],
    concepts: ['fine-tuning-decision', 'rag-vs-fine-tuning', 'llm-deployment-patterns'],
    companies: ['OpenAI', 'Anthropic', 'Cohere', 'Together'],
  },
  {
    id: 'ai-020',
    topic: 'Fine-tuning',
    difficulty: 'senior',
    prompt:
      'Explain LoRA (Low-Rank Adaptation). What problem does it solve compared to full fine-tuning, and how does the rank hyperparameter affect the tradeoff between expressiveness and parameter efficiency?',
    hints: [
      'Full fine-tuning updates all parameters — expensive, requires full model in memory',
      'LoRA: freeze base weights, add small low-rank matrices A and B (W = W0 + BA)',
      'Lower rank = fewer parameters = less expressive but cheaper; typical ranks: 4–64',
    ],
    concepts: ['lora', 'peft', 'fine-tuning-efficiency'],
    companies: ['Hugging Face', 'Together', 'Replicate', 'Mistral'],
  },
  {
    id: 'ai-021',
    topic: 'Fine-tuning',
    difficulty: 'senior',
    prompt:
      'What is DPO (Direct Preference Optimization), and how does it differ from RLHF? Why has DPO become popular for alignment fine-tuning, and what are its limitations?',
    hints: [
      'RLHF: train reward model from comparisons, then PPO — complex two-stage pipeline',
      'DPO: directly optimizes policy from preference pairs, no separate reward model',
      'DPO limitations: sensitive to reference model, can over-optimize on preference format',
    ],
    concepts: ['dpo', 'rlhf', 'alignment-techniques', 'preference-learning'],
    companies: ['Anthropic', 'OpenAI', 'Meta', 'Mistral'],
  },
  {
    id: 'ai-022',
    topic: 'Fine-tuning',
    difficulty: 'mid',
    prompt:
      `You have 500 labeled examples for a customer support fine-tune. How do you split train/validation/test sets, and what special concerns apply to LLM fine-tuning datasets that don't apply to classical ML datasets?`,
    hints: [
      'Data quality matters more than quantity for LLM fine-tuning',
      `Contamination: ensure test examples don't appear in training (exact or near-duplicate)`,
      'Prompt format consistency: training examples must match inference-time format exactly',
    ],
    concepts: ['fine-tuning-data', 'data-quality', 'train-test-split'],
    companies: ['OpenAI', 'Cohere', 'Scale', 'Hugging Face'],
  },
  {
    id: 'ai-023',
    topic: 'Fine-tuning',
    difficulty: 'senior',
    prompt:
      'After fine-tuning, your model scores higher on your target task but has degraded on general capabilities — it now fails at math and reasoning it could do before. What is this phenomenon, and how do you mitigate it while preserving task gains?',
    hints: [
      'Catastrophic forgetting: new fine-tuning overwrites previous learned weights',
      'Mitigation: replay general data alongside task data in training mix',
      'LoRA/PEFT reduces forgetting by keeping base weights frozen',
    ],
    concepts: ['catastrophic-forgetting', 'fine-tuning-efficiency', 'lora'],
    companies: ['Anthropic', 'OpenAI', 'Hugging Face'],
  },
  {
    id: 'ai-024',
    topic: 'Fine-tuning',
    difficulty: 'mid',
    prompt:
      'Explain QLoRA. How does it differ from LoRA, and what makes it practical for fine-tuning large models (70B+) on consumer hardware?',
    hints: [
      'QLoRA: quantize base model to 4-bit NormalFloat, then apply LoRA adapters in 16-bit',
      'Double quantization further reduces memory of quantization constants',
      'Paged optimizers: offload optimizer states to CPU RAM when GPU is full',
    ],
    concepts: ['qlora', 'lora', 'quantization', 'fine-tuning-efficiency'],
    companies: ['Hugging Face', 'Together', 'Replicate'],
  },
  {
    id: 'ai-025',
    topic: 'Fine-tuning',
    difficulty: 'senior',
    prompt:
      `You're fine-tuning a model for a medical Q&A application. Walk through your data curation process, training approach, and evaluation strategy, with special attention to safety and hallucination risks in high-stakes domains.`,
    hints: [
      'Data curation: physician-reviewed Q&A pairs, adversarial examples, refusal cases',
      'Safety training: RLHF/DPO with preference labels on safe vs. unsafe responses',
      'Evaluation: domain expert reviews, red-teaming, calibration of uncertainty expressions',
    ],
    concepts: ['fine-tuning-data', 'alignment-techniques', 'llm-evaluation-metrics', 'hallucination'],
    companies: ['Anthropic', 'OpenAI', 'Google'],
  },
  {
    id: 'ai-026',
    topic: 'Fine-tuning',
    difficulty: 'mid',
    prompt:
      'How do you evaluate whether a fine-tuned model is actually better than the base model with a good prompt? Describe an evaluation methodology that controls for the fact that the fine-tuned model has "seen" its training format.',
    hints: [
      'Hold out a test set that was never used in fine-tuning or prompt development',
      'Compare: fine-tuned zero-shot vs. base model with best prompt on same test set',
      'Human preference evaluation: blind A/B between outputs',
    ],
    concepts: ['fine-tuning-decision', 'llm-evaluation-metrics', 'overfitting'],
    companies: ['OpenAI', 'Anthropic', 'Cohere', 'Scale'],
  },

  // ─── LLM Evaluation (ai-027–ai-034) ─────────────────────────────────────────

  {
    id: 'ai-027',
    topic: 'LLM Evaluation',
    difficulty: 'mid',
    prompt:
      'What is hallucination in LLMs, and how do you distinguish between "factual hallucination" and "faithfulness hallucination"? Why is the latter especially critical in RAG systems?',
    hints: [
      'Factual hallucination: model states something untrue about the world',
      'Faithfulness hallucination: model contradicts or invents facts not in the provided context',
      'In RAG, faithfulness is measurable — you have the source context to check against',
    ],
    concepts: ['hallucination', 'ragas', 'llm-evaluation-metrics'],
    companies: ['Anthropic', 'OpenAI', 'Cohere'],
  },
  {
    id: 'ai-028',
    topic: 'LLM Evaluation',
    difficulty: 'senior',
    prompt:
      'Walk me through the RAGAS evaluation framework. What does each metric measure, and how are they computed? What are the limitations of using an LLM judge for these metrics?',
    hints: [
      'Faithfulness: fraction of claims in answer that are supported by context (LLM judge)',
      'Answer relevance: how well the answer addresses the question (embedding similarity)',
      'Context precision: what fraction of retrieved context is actually relevant',
      'Context recall: fraction of ground-truth facts found in retrieved context',
    ],
    concepts: ['ragas', 'llm-evaluation-metrics', 'rag-evaluation'],
    companies: ['Cohere', 'Anthropic', 'OpenAI', 'LangChain'],
  },
  {
    id: 'ai-029',
    topic: 'LLM Evaluation',
    difficulty: 'mid',
    prompt:
      `You are using an LLM-as-judge to evaluate another LLM's outputs at scale. What biases are known to affect LLM judges, and how do you mitigate them in your evaluation pipeline?`,
    hints: [
      'Position bias: judges prefer the first option presented — randomize presentation order',
      'Self-preference bias: GPT-4 may prefer GPT-4 outputs over others',
      'Verbosity bias: longer answers rated higher regardless of quality — calibrate rubric',
    ],
    concepts: ['llm-as-judge', 'evaluation-bias', 'llm-evaluation-metrics'],
    companies: ['Anthropic', 'OpenAI', 'Scale', 'Cohere'],
  },
  {
    id: 'ai-030',
    topic: 'LLM Evaluation',
    difficulty: 'senior',
    prompt:
      'Design an A/B testing framework for comparing two LLM prompt versions in production. What are the statistical challenges specific to LLM output evaluation, and how do you determine sample size and stopping criteria?',
    hints: [
      'LLM outputs have high variance — need larger sample sizes than click-through A/B tests',
      'Human preference as binary label: prefer A or B, then power analysis for significance',
      'Peeking problem: stop only when planned sample size reached or sequential test allows',
    ],
    concepts: ['ab-testing', 'llm-evaluation-metrics', 'statistical-significance'],
    companies: ['OpenAI', 'Anthropic', 'Google', 'Scale'],
  },
  {
    id: 'ai-031',
    topic: 'LLM Evaluation',
    difficulty: 'mid',
    prompt:
      `What is "calibration" in the context of LLMs, and why is it important for applications where the model expresses uncertainty? How would you measure and improve a model's calibration?`,
    hints: [
      `Calibration: when a model says it's 80% confident, it should be right 80% of the time`,
      'Measure: reliability diagrams, Expected Calibration Error (ECE)',
      'LLMs are often overconfident — post-hoc calibration via temperature scaling',
    ],
    concepts: ['model-calibration', 'uncertainty-quantification', 'llm-evaluation-metrics'],
    companies: ['Anthropic', 'OpenAI', 'Google'],
  },
  {
    id: 'ai-032',
    topic: 'LLM Evaluation',
    difficulty: 'senior',
    prompt:
      'Your company ships a new model version and you need an automated regression test suite that runs in CI in under 10 minutes. How do you build this? What do you sacrifice vs. a full evaluation run?',
    hints: [
      'Curate a small (~200 question) representative eval set that runs quickly',
      'Use deterministic metrics (exact match, format checks) for speed',
      'Reserve expensive LLM-judge evals for pre-release; CI catches obvious regressions',
    ],
    concepts: ['llm-evaluation-metrics', 'ci-cd-for-ml', 'evaluation-efficiency'],
    companies: ['Anthropic', 'OpenAI', 'Hugging Face', 'Scale'],
  },
  {
    id: 'ai-033',
    topic: 'LLM Evaluation',
    difficulty: 'mid',
    prompt:
      'What is "benchmark contamination," and why has it become a major concern with modern LLM evaluations? How would you design a benchmark that is resistant to contamination?',
    hints: [
      'Contamination: training data contains benchmark test questions — model memorized answers',
      'Detection: canary tokens, n-gram overlap analysis between training and benchmark data',
      'Resistance: generate new questions programmatically, use dynamic evals, keep holdout private',
    ],
    concepts: ['benchmark-contamination', 'llm-evaluation-metrics', 'data-quality'],
    companies: ['Hugging Face', 'Google', 'Meta', 'Anthropic'],
  },
  {
    id: 'ai-034',
    topic: 'LLM Evaluation',
    difficulty: 'senior',
    prompt:
      `How do you evaluate a conversational AI system end-to-end? Single-turn metrics like BLEU and ROUGE don't capture multi-turn coherence. What metrics and methodologies cover task completion, consistency, and user satisfaction?`,
    hints: [
      'Task completion rate: did the user accomplish their goal by end of conversation?',
      'Coherence: does the model maintain context and not contradict earlier turns?',
      'User satisfaction: CSAT surveys, conversation abandonment rate, escalation rate',
    ],
    concepts: ['conversational-ai-evaluation', 'llm-evaluation-metrics', 'user-experience-metrics'],
    companies: ['Anthropic', 'OpenAI', 'Google', 'Microsoft'],
  },

  // ─── Vector Databases (ai-035–ai-042) ──────────────────────────────────────

  {
    id: 'ai-035',
    topic: 'Vector Databases',
    difficulty: 'mid',
    prompt:
      'Explain the Approximate Nearest Neighbor (ANN) problem. Why is exact nearest neighbor search impractical at billion-vector scale, and what property of high-dimensional spaces makes this especially hard?',
    hints: [
      'Exact k-NN: O(n×d) per query — linear scan, too slow for large n',
      'Curse of dimensionality: in high-dimensional spaces, distance between points converges',
      'ANN trades recall for speed: indexes like HNSW or IVF find approximate neighbors fast',
    ],
    concepts: ['ann-search', 'vector-indexing', 'high-dimensional-search'],
    companies: ['Pinecone', 'Weaviate', 'Qdrant', 'Milvus'],
  },
  {
    id: 'ai-036',
    topic: 'Vector Databases',
    difficulty: 'senior',
    prompt:
      'Compare HNSW (Hierarchical Navigable Small World) and IVF (Inverted File Index) for vector search. What are the tradeoffs in index build time, query time, recall, and memory usage? When would you choose each?',
    hints: [
      'HNSW: graph-based, excellent recall, fast queries, high memory (~100 bytes/vector at dim=128)',
      'IVF: cluster-based (k-means), lower memory, slower build, tunable recall via nprobe',
      'HNSW for latency-sensitive; IVF+PQ for very large-scale with memory constraints',
    ],
    concepts: ['hnsw', 'ivf-index', 'vector-indexing', 'ann-search'],
    companies: ['Pinecone', 'Weaviate', 'Milvus', 'Qdrant'],
  },
  {
    id: 'ai-037',
    topic: 'Vector Databases',
    difficulty: 'mid',
    prompt:
      'What is Product Quantization (PQ) and how does it reduce vector storage by 4–32×? What accuracy tradeoff does it introduce, and what is the difference between PQ and scalar quantization?',
    hints: [
      'PQ: split vector into M subvectors, quantize each to a codebook of k centroids',
      'Storage: M×log2(k) bits per vector instead of d×32 bits',
      'Scalar quantization (SQ): round each dimension to 8-bit integer — simpler but less compression',
    ],
    concepts: ['product-quantization', 'vector-compression', 'vector-indexing'],
    companies: ['Pinecone', 'Faiss', 'Milvus'],
  },
  {
    id: 'ai-038',
    topic: 'Vector Databases',
    difficulty: 'senior',
    prompt:
      'You need to add metadata filtering to a vector search (e.g., filter by tenant, date range, and category before returning nearest neighbors). What approaches exist, and why is "pre-filter vs. post-filter" a non-trivial design decision?',
    hints: [
      'Post-filter: search all vectors, then filter by metadata — may return fewer than k results',
      'Pre-filter: filter index before search — correct but expensive if filter is not selective',
      'Segment-based: maintain separate indexes per tenant/category — fast but combinatorial explosion',
    ],
    concepts: ['vector-metadata-filtering', 'ann-search', 'vector-database-isolation'],
    companies: ['Pinecone', 'Weaviate', 'Qdrant', 'Milvus'],
  },
  {
    id: 'ai-039',
    topic: 'Vector Databases',
    difficulty: 'mid',
    prompt:
      `When should you use pgvector instead of a dedicated vector database like Pinecone or Weaviate? What are pgvector's limitations at scale, and how do you know when you've outgrown it?`,
    hints: [
      'pgvector wins: already using Postgres, ACID transactions with metadata, small-scale (<1M vectors)',
      'Dedicated wins: billion-scale, distributed index, advanced ANN algorithms, real-time updates',
      'pgvector HNSW index does not support concurrent inserts well — locks during index build',
    ],
    concepts: ['pgvector', 'vector-database-tradeoffs', 'ann-search'],
    companies: ['Supabase', 'Neon', 'Pinecone', 'Weaviate'],
  },
  {
    id: 'ai-040',
    topic: 'Vector Databases',
    difficulty: 'senior',
    prompt:
      'Explain the concept of "recall@k" in vector search evaluation. How do you measure recall for an ANN index, and how do you tune HNSW parameters (ef_construction, M, ef_search) to hit a target recall?',
    hints: [
      'Recall@k: fraction of true k nearest neighbors returned by ANN among its k results',
      'Measure: brute-force exact search on sample, compare to HNSW results',
      'ef_construction + M control index quality (build-time); ef_search controls query-time recall vs. speed',
    ],
    concepts: ['hnsw', 'ann-recall', 'vector-indexing'],
    companies: ['Pinecone', 'Weaviate', 'Qdrant', 'Faiss'],
  },
  {
    id: 'ai-041',
    topic: 'Vector Databases',
    difficulty: 'mid',
    prompt:
      'What is "embedding drift," and why does it cause problems in production RAG or recommendation systems over time? How do you detect it, and what does your remediation process look like?',
    hints: [
      'Embedding drift: model provider updates embedding model, new embeddings are incompatible with old',
      'Detection: monitor cosine similarity distribution shift, random sample comparisons',
      'Remediation: re-embed all documents with new model — requires downtime or blue-green index swap',
    ],
    concepts: ['embedding-models', 'rag-index-management', 'mlops-monitoring'],
    companies: ['OpenAI', 'Cohere', 'Pinecone', 'Weaviate'],
  },
  {
    id: 'ai-042',
    topic: 'Vector Databases',
    difficulty: 'senior',
    prompt:
      'Design a vector search system that handles 10,000 writes/second and 5,000 queries/second at p99 < 50ms with 100M vectors. Walk through your architecture choices for indexing, sharding, and replication.',
    hints: [
      'Sharding by namespace or hash; distributed HNSW or IVF across shards',
      'Write path: async index update with eventual consistency acceptable for search',
      'Read replicas for query load; routing layer to scatter-gather across shards',
    ],
    concepts: ['vector-database-scalability', 'ann-search', 'distributed-systems'],
    companies: ['Pinecone', 'Weaviate', 'Milvus', 'Qdrant'],
  },

  // ─── MLOps / LLMOps (ai-043–ai-052) ─────────────────────────────────────────

  {
    id: 'ai-043',
    topic: 'MLOps / LLMOps',
    difficulty: 'mid',
    prompt:
      `What is LLMOps, and how does it differ from traditional MLOps? Name three production concerns specific to LLM-based systems that don't exist (or matter much less) for classical ML models.`,
    hints: [
      'Prompt version control: prompts are code, changing them changes model behavior',
      'Cost observability: token consumption and latency per request are key metrics',
      'Output safety: classical models output numbers; LLMs output free text that can be harmful',
    ],
    concepts: ['llmops', 'mlops', 'llm-deployment-patterns'],
    companies: ['Anthropic', 'OpenAI', 'Weights & Biases', 'LangSmith'],
  },
  {
    id: 'ai-044',
    topic: 'MLOps / LLMOps',
    difficulty: 'senior',
    prompt:
      'You need to reduce the p99 latency of an LLM inference endpoint from 8 seconds to under 2 seconds. The model is a 70B parameter model running on 4xA100. Walk through your optimization options.',
    hints: [
      'Quantization: INT8/INT4 reduces memory, allows higher batch size or smaller GPU config',
      'KV cache optimization: flash attention, paged attention (vLLM) for efficient memory use',
      'Speculative decoding: small draft model generates tokens, large model verifies in parallel',
    ],
    concepts: ['llm-inference-optimization', 'quantization', 'speculative-decoding'],
    companies: ['Anthropic', 'Together', 'Replicate', 'Groq'],
  },
  {
    id: 'ai-045',
    topic: 'MLOps / LLMOps',
    difficulty: 'mid',
    prompt:
      'What is "prompt versioning," and why is it critical in LLMOps? How do you implement a prompt version control system that supports rollback, A/B testing, and audit trails?',
    hints: [
      'Prompts are configuration, not code — but changing them changes behavior as dramatically as code changes',
      'Store prompts in a database with version history, not hard-coded in source',
      'Rollback: swap active prompt version without redeploying application code',
    ],
    concepts: ['prompt-versioning', 'llmops', 'prompt-reliability'],
    companies: ['LangSmith', 'Weights & Biases', 'Anthropic', 'OpenAI'],
  },
  {
    id: 'ai-046',
    topic: 'MLOps / LLMOps',
    difficulty: 'senior',
    prompt:
      'Design an LLM observability stack for a production application handling 100,000 requests/day. What do you log, what alerts do you set, and how do you attribute cost, latency, and quality to individual features or user segments?',
    hints: [
      'Log: request ID, model, prompt version, token counts, latency, output hash, user segment',
      'Alerts: latency p99 spike, error rate increase, cost anomaly, safety filter trigger rate',
      'Attribution: tag requests with feature_id and user_tier for cost and quality breakdown',
    ],
    concepts: ['llm-observability', 'llmops', 'cost-attribution'],
    companies: ['LangSmith', 'Weights & Biases', 'Datadog', 'Anthropic'],
  },
  {
    id: 'ai-047',
    topic: 'MLOps / LLMOps',
    difficulty: 'mid',
    prompt:
      'What is "model routing" in LLMOps, and how would you implement a system that automatically selects between a cheap fast model and an expensive accurate model based on request characteristics?',
    hints: [
      'Route by complexity: classifier or heuristic (question length, topic) → cheap vs. flagship',
      'Route by confidence: if cheap model output is low confidence, escalate to flagship',
      'Cost-aware: track per-user/feature budget, downgrade when approaching limits',
    ],
    concepts: ['model-routing', 'llm-cost-optimization', 'llmops'],
    companies: ['OpenRouter', 'Anthropic', 'Together', 'Martian'],
  },
  {
    id: 'ai-048',
    topic: 'MLOps / LLMOps',
    difficulty: 'senior',
    prompt:
      'How do you safely deploy a new fine-tuned model version to production? Walk through a deployment strategy that minimizes risk, including how you handle traffic splitting, canary analysis, and automatic rollback triggers.',
    hints: [
      'Canary deploy: send 1–5% of traffic to new model, compare metrics to baseline',
      'Automatic rollback: if error rate or safety filter rate spikes above threshold, revert',
      'Shadow mode: run new model in parallel, log outputs but never serve them to users first',
    ],
    concepts: ['mlops-deployment', 'canary-deployment', 'llm-deployment-patterns'],
    companies: ['Anthropic', 'OpenAI', 'Google', 'Hugging Face'],
  },
  {
    id: 'ai-049',
    topic: 'MLOps / LLMOps',
    difficulty: 'mid',
    prompt:
      'What is "data flywheel" in the context of AI products, and how do you architect a system that continuously improves model quality using production data without violating user privacy?',
    hints: [
      'Data flywheel: more users → more data → better model → more users',
      'Privacy: anonymize, get consent, sample (not log everything), store in compliant data warehouse',
      'Feedback signals: explicit (thumbs up/down), implicit (copy, share, regenerate actions)',
    ],
    concepts: ['data-flywheel', 'llmops', 'data-privacy'],
    companies: ['Anthropic', 'OpenAI', 'Google', 'Scale'],
  },
  {
    id: 'ai-050',
    topic: 'MLOps / LLMOps',
    difficulty: 'senior',
    prompt:
      'Your LLM application is hitting rate limits from your model provider. Describe your short-term mitigation and long-term architecture to handle 10× traffic growth without being blocked by provider rate limits.',
    hints: [
      'Short-term: request queuing with backoff, semantic caching, reduce token usage per request',
      'Long-term: multi-provider fallback (Anthropic + OpenAI + self-hosted), provider-agnostic abstraction',
      'Self-hosted open models: eliminates rate limit dependency, adds operational burden',
    ],
    concepts: ['rate-limiting', 'llm-cost-optimization', 'llm-deployment-patterns'],
    companies: ['Together', 'Replicate', 'Groq', 'Anthropic'],
  },
  {
    id: 'ai-051',
    topic: 'MLOps / LLMOps',
    difficulty: 'mid',
    prompt:
      'What is "semantic caching" for LLM applications, and how does it differ from exact-match caching? What are the risks of serving cached LLM responses, and how do you manage cache staleness?',
    hints: [
      'Semantic cache: embed incoming query, search for cached responses to similar past queries',
      'Risk: semantically similar queries may have different correct answers (date-sensitive, user-specific)',
      'TTL + context hashing: cache key includes model version, system prompt hash, and recency window',
    ],
    concepts: ['llm-caching', 'semantic-caching', 'llmops'],
    companies: ['GPTCache', 'Redis', 'Pinecone', 'Anthropic'],
  },
  {
    id: 'ai-052',
    topic: 'MLOps / LLMOps',
    difficulty: 'senior',
    prompt:
      'How do you handle model versioning when you use both a third-party API (like Claude or GPT-4) and a fine-tuned model derived from it? What changes across a provider model upgrade, and how do you detect and respond to silent API changes?',
    hints: [
      'Pin to specific model version IDs, not "latest" — provider upgrades can break behavior',
      'Regression suite: run before promoting a new model version in production',
      'Silent changes: monitor output distribution, not just error rates — behavior can change without errors',
    ],
    concepts: ['model-versioning', 'llmops', 'regression-testing'],
    companies: ['Anthropic', 'OpenAI', 'Google', 'Weights & Biases'],
  },

  // ─── Agent Architecture (ai-053–ai-060) ────────────────────────────────────

  {
    id: 'ai-053',
    topic: 'Agent Architecture',
    difficulty: 'mid',
    prompt:
      'What is an "LLM agent," and how does it differ from a simple LLM call? Describe the ReAct (Reasoning + Acting) loop. What are the main failure modes of the basic ReAct pattern?',
    hints: [
      'ReAct: Thought → Action → Observation → Thought → … loop until terminal state',
      'Failure modes: infinite loops, tool call hallucination, cascading errors, context exhaustion',
      'Unlike chatbots, agents take actions with side effects — failures can be destructive',
    ],
    concepts: ['agent-architecture', 'react-pattern', 'tool-use'],
    companies: ['Anthropic', 'OpenAI', 'LangChain', 'AutoGen'],
  },
  {
    id: 'ai-054',
    topic: 'Agent Architecture',
    difficulty: 'senior',
    prompt:
      'Compare single-agent vs. multi-agent architectures for a complex research task. What orchestration patterns exist (orchestrator-subagent, peer-to-peer, critic-actor), and what problems does each solve?',
    hints: [
      'Orchestrator-subagent: central LLM decomposes task, delegates to specialists',
      'Critic-actor: one agent generates, another reviews — catches errors but doubles cost',
      'Peer-to-peer: agents communicate via shared message bus — complex state management',
    ],
    concepts: ['multi-agent', 'agent-orchestration', 'agent-architecture'],
    companies: ['Anthropic', 'OpenAI', 'Microsoft', 'LangChain'],
  },
  {
    id: 'ai-055',
    topic: 'Agent Architecture',
    difficulty: 'mid',
    prompt:
      'How do you give an LLM agent memory that persists across conversations and is relevant to the current task? Describe the different types of agent memory (in-context, external retrieval, episodic, semantic) and when to use each.',
    hints: [
      'In-context: fastest, but limited by window size — good for current task state',
      'External retrieval (RAG): unlimited scale, retrieval adds latency — good for long-term facts',
      'Episodic: past conversation summaries; semantic: distilled facts about user/domain',
    ],
    concepts: ['agent-memory', 'rag-architecture', 'agent-architecture'],
    companies: ['Anthropic', 'OpenAI', 'LangChain', 'Mem'],
  },
  {
    id: 'ai-056',
    topic: 'Agent Architecture',
    difficulty: 'senior',
    prompt:
      `You're building an agent that can write and execute code. What are the security considerations, and how do you implement sandboxing? What failure modes arise when agents can modify their own environment?`,
    hints: [
      'Sandboxing: Docker container with no network, read-only filesystem except scratch dir, CPU/memory limits',
      'Code injection: agent may generate code that reads secrets or exfiltrates data',
      'Self-modification: agent could rewrite its own system prompt or memory — need integrity checks',
    ],
    concepts: ['agent-security', 'sandboxing', 'llm-security'],
    companies: ['Anthropic', 'OpenAI', 'E2B', 'Modal'],
  },
  {
    id: 'ai-057',
    topic: 'Agent Architecture',
    difficulty: 'mid',
    prompt:
      'What is "tool use" in LLM agents, and how does function calling differ from asking the model to output a JSON command that your code then parses? What are the reliability and security implications of each approach?',
    hints: [
      'Native function calling: model outputs structured tool invocations, provider validates schema',
      'JSON-in-text: model outputs JSON embedded in prose — brittle, requires parsing heuristics',
      'Security: function calling limits tool surface; free-form JSON can smuggle unexpected commands',
    ],
    concepts: ['function-calling', 'tool-use', 'structured-output'],
    companies: ['Anthropic', 'OpenAI', 'Google', 'Mistral'],
  },
  {
    id: 'ai-058',
    topic: 'Agent Architecture',
    difficulty: 'senior',
    prompt:
      'How do you implement reliable error handling and recovery in a long-running agent loop? The agent has taken 15 steps and a tool call fails at step 16. What are your options, and how do you prevent unbounded retries?',
    hints: [
      'Retry budget: max N retries per tool, then surface error to user or choose alternate path',
      'Checkpointing: save agent state after each successful step — resume without replaying',
      'Human-in-the-loop: on high-stakes failures, pause and request user confirmation',
    ],
    concepts: ['agent-fault-tolerance', 'agent-architecture', 'human-in-the-loop'],
    companies: ['Anthropic', 'OpenAI', 'LangChain', 'AutoGen'],
  },
  {
    id: 'ai-059',
    topic: 'Agent Architecture',
    difficulty: 'mid',
    prompt:
      `What is the "context window management" problem in long-running agents, and what strategies exist for keeping the agent's working context relevant without hitting token limits?`,
    hints: [
      'Summarization: compress earlier steps into a summary, keep recent steps in full',
      'Selective retention: keep only tool call results and decisions, drop reasoning traces',
      'External memory: move completed sub-tasks out of context into a retrieval store',
    ],
    concepts: ['context-window', 'agent-memory', 'agent-architecture'],
    companies: ['Anthropic', 'OpenAI', 'LangChain'],
  },
  {
    id: 'ai-060',
    topic: 'Agent Architecture',
    difficulty: 'senior',
    prompt:
      'Design a production-grade autonomous agent system for processing 10,000 customer support tickets/day. The agent can: read CRM data, draft responses, escalate to human agents, and close tickets. Walk through your architecture, safety guardrails, and monitoring strategy.',
    hints: [
      'Safety: confidence threshold for autonomous action; low-confidence → human review queue',
      'Audit trail: log every tool call, decision, and escalation with reasoning for compliance',
      'Monitoring: escalation rate, resolution rate, customer CSAT — detect drift in agent behavior',
    ],
    concepts: ['agent-architecture', 'human-in-the-loop', 'llm-observability', 'agent-fault-tolerance'],
    companies: ['Anthropic', 'Salesforce', 'Zendesk', 'OpenAI'],
  },
]
