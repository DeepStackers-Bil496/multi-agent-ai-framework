# Method & Design — Konuşma Scripti (150 sn)

Slayt akışı: 14 → 15 → 16 → 17. Her slaytın yanında tahmini süre var. Toplam ≈ 150 sn, ≈ 380 kelime. Hız: rahat, aceleye getirmeden.

---

## Açılış (5 sn)

Şimdi sistemin teknik tasarımına geliyoruz. Dört slaytta sırasıyla: **mimari katmanlar**, **tasarım prensiplerimiz**, **MainAgent'ın orkestrasyon akışı** ve en altta çalışan **LangGraph state graph**.

---

## Slayt 14 — System Architecture (30 sn)

Framework'ümüz altı katmanlı bir mimariye sahip.

En üstte **Next.js 15 tabanlı Client Layer** var — Chat UI, Agent Selector ve sistemin canlı çalışmasını göstermek için tasarladığımız **Execution Flow component**. Onun altında **API Gateway**: tek bir `/api/chat` endpoint'i ve **NextAuth v5** ile kimlik doğrulama.

Asıl zeka **Main Agent / Orchestrator** katmanında: MainAgent sınıfı, **AgentRegistry**, delegasyon tool'larını dinamik üreten factory ve runtime'da graph kuran Dynamic Graph Builder. Onun altında **dokuz uzman ajan** paralel duruyor: GitHub, Codebase, Google Workspace, Search, Vision, Data Analyst, Coding, Frontend ve Hugging Face.

**Tool Layer**'da GitHub MCP'den 19, Google API'larından 27 tool, Python için E2B sandbox, RAG için pgvector ve Exa web search var. **Data Layer** ise Neon PostgreSQL, 768 boyutlu pgvector HNSW index, Drizzle ORM, Redis ve Vercel Blob.

---

## Slayt 15 — Methodological Framework Components (35 sn)

Bu mimariyi ayakta tutan **üç temel tasarım prensibi** var.

**Birincisi — Delegation-as-a-Tool Orchestration.** MainAgent özel bir workflow motoru kullanmıyor. Bunun yerine, her uzman ajana `delegate_to_github`, `delegate_to_search` gibi dinamik üretilmiş tool'lar üzerinden erişiyor. Yani orkestrasyon tamamen **LLM'in kendi tool calling yeteneği üstünde** çalışıyor — karar verme mantığı LLM'de.

**İkincisi — Self-Registration Plugin Architecture.** Her ajan modül yüklenirken `agentRegistry.register` çağrısıyla kendini kaydediyor. Yeni bir uzman ajan eklemek için çekirdek routing koduna **tek satır dokunmuyoruz**; ajan ID, tool adı ve graph referansını registry otomatik alıyor.

**Üçüncüsü — Stateful ReAct Cycles + RAG.** LangGraph'ın `MessagesAnnotation` state'i üzerinde düşün-eyle döngüsü dönüyor ve kod arama için **AST-aware** chunk'lanmış — yani fonksiyon ve sınıf seviyesinde parçalanmış — pgvector embedding'leri kullanılıyor.

---

## Slayt 16 — MainAgent Orchestration Flow (40 sn)

Akışın tamamına bakalım.

Kullanıcı mesaj gönderir. MainAgent mesajı ve chat geçmişini parse eder, LLM'e tek bir karar sorar: **"doğrudan cevapla, yoksa delege et?"** Basit bir soru gelirse `Generate direct answer` dalına gidip yanıt üretiyor.

Delegasyon gerekiyorsa LLM bir `delegate_to_X` tool call'u üretiyor. AgentRegistry üzerinden hedef ajan bulunuyor, ardından **Prepare Task node** kritik bir iş yapıyor: orijinal kullanıcı isteğini ve önceki ajanların çıktılarını tek bir temiz `HumanMessage`'a enjekte ediyor. Bu sayede sub-agent gürültülü accumulated state yerine **kendine ait clean bir context** alıyor.

Uzman ajanın subgraph'ı kendi ReAct döngüsüyle tool'larını çalıştırıyor, sonuç MainAgent'a dönüyor. Buradaki **en kritik detay**: MainAgent tek bir kullanıcı turunda bu döngüyü birden fazla kez kurabiliyor. Yani kompleks bir görevi **beş-altı ajanı sırayla zincirleyerek, kullanıcıya hiç sormadan**, tek bir final yanıtta birleştirebiliyor.

---

## Slayt 17 — LangGraph StateGraph + ReAct Cycle (40 sn)

En alt seviyede her ajan aynı **StateGraph şablonunu** paylaşır. START'tan sonra sistem prompt'u mesajların başına prepend ediliyor ve tool'lar LLM'e bind ediliyor. **Agent Node** LLM'i çağırır; cevap `tool_calls` içeriyorsa **Tools Node** birden fazla tool'u concurrent çalıştırır, çıktılar `MessagesAnnotation` state'ine append edilir ve döngü Agent Node'a geri döner. Tool call kalmadığında END'e çıkar.

Sağ taraftaki akışa dikkat edin: LangGraph'ın `streamEvents v2` API'si bu döngünün **her anında** `AGENT_STARTED`, `AGENT_STREAM`, `TOOL_STARTED`, `TOOL_ENDED` ve `AGENT_ENDED` event'lerini **NDJSON formatında** frontend'e push ediyor.

Bu sayede kullanıcı modelin hangi tool'u ne zaman çalıştırdığını — yani **"thinking process"ini gerçek zamanlı** olarak Execution Flow panelinde görüyor. Literatür taramasında bahsettiğimiz **"kara kutu" problemini tam olarak bu çözüyor**.

---

## Kapanış geçişi (tek cümle)

Bu mimarinin kodda nasıl hayata geçtiğini bir sonraki Implementation bölümünde göreceğiz.
