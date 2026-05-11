-- Migration: 1강 핵심 단어 vocab_entries 시드
--
-- 1강 문장("누가 + 어쩐다 + 뭐를")에 등장하는 동사·명사에 대해
-- etymology(어원 분해) + mnemonic(한국어 연상) 데이터를 삽입한다.
-- 대명사(I, you, he, she 등)는 어원 분해 가치가 낮아 제외.
--
-- JSON 구조:
--   etymology: { parts: [{text, meaning}], gloss?, related? }
--   mnemonic:  { korean_phrase, story? }

INSERT INTO public.vocab_entries (word, pos, meaning_ko, ipa, etymology, mnemonic, example_sentence_ids) VALUES

-- ─── 동사 ───────────────────────────────────────────────────────────────────

('love', 'v.', '사랑하다', '/lʌv/',
  '{"parts": [{"text": "love", "meaning": "고대영어 lufu, 깊은 애정"}], "gloss": "깊은 애정을 느끼다", "related": ["lovely", "lover", "beloved"]}',
  '{"korean_phrase": "러브 → 러브라고 외치며 사랑을 고백하는 장면", "story": "\"러브!\" 하고 외치면 상대방이 하트를 날려주는 모습을 떠올려 보세요."}',
  '{}'),

('like', 'v.', '좋아하다', '/laɪk/',
  '{"parts": [{"text": "like", "meaning": "고대영어 līcian, 기쁘게 하다"}], "gloss": "무언가를 즐기거나 선호하다", "related": ["likely", "likeable", "dislike"]}',
  '{"korean_phrase": "라이크 → 라이터로 ♡를 켜듯 좋아하는 마음에 불을 붙이다", "story": "라이터(lighter)를 켜서 하트 모양 불꽃이 피어오르는 장면을 상상하세요."}',
  '{}'),

('want', 'v.', '원하다', '/wɑːnt/',
  '{"parts": [{"text": "want", "meaning": "고대 노르드어 vanta, 부족하다"}], "gloss": "무언가가 부족해서 갖고 싶다", "related": ["wanted", "unwanted"]}',
  '{"korean_phrase": "원트 → 원(하나)도 없어서 간절히 원하다", "story": "지갑에 원(1원)도 없어서 간절히 뭔가를 원하는 모습을 떠올려 보세요."}',
  '{}'),

('need', 'v.', '필요하다', '/niːd/',
  '{"parts": [{"text": "need", "meaning": "고대영어 nēd, 필요·강제"}], "gloss": "반드시 있어야 하는 것", "related": ["needy", "needless"]}',
  '{"korean_phrase": "니드 → 니(네가) 드(들고) 와야 해! 필요하니까!", "story": "\"니가 들고 와!\" 하고 급하게 부르는 장면 — 그만큼 필요하다는 뜻."}',
  '{}'),

('have', 'v.', '가지다', '/hæv/',
  '{"parts": [{"text": "have", "meaning": "고대영어 habban, 소유하다"}], "gloss": "소유하거나 경험하다", "related": ["haven", "behave"]}',
  '{"korean_phrase": "해브 → 해(바다)에 보물을 가지고 있다", "story": "해적이 바다(해) 밑에 보물 상자를 가지고(have) 있는 장면을 상상하세요."}',
  '{}'),

('know', 'v.', '알다', '/noʊ/',
  '{"parts": [{"text": "know", "meaning": "고대영어 cnāwan, 인식하다"}], "gloss": "정보나 사실을 인식하다", "related": ["knowledge", "known", "unknown"]}',
  '{"korean_phrase": "노우 → 노(No)라고 말하려면 먼저 알아야(know) 한다", "story": "\"No!\"라고 거절하려면 상황을 알아야(know) 하잖아요."}',
  '{}'),

-- ─── 명사 ───────────────────────────────────────────────────────────────────

('coffee', 'n.', '커피', '/ˈkɔːfi/',
  '{"parts": [{"text": "coffee", "meaning": "아랍어 qahwa → 터키어 kahve → 유럽 전파"}], "gloss": "커피나무 열매로 만든 음료", "related": ["cafe", "caffeine"]}',
  '{"korean_phrase": "커피 → 그대로 커피! 아침에 마시는 그 커피", "story": "발음이 거의 같아서 그대로 기억하면 됩니다. 카페(cafe)도 같은 어원이에요."}',
  '{}'),

('pizza', 'n.', '피자', '/ˈpiːtsə/',
  '{"parts": [{"text": "pizza", "meaning": "이탈리아어, 납작한 빵 위에 토핑을 올린 음식"}], "gloss": "도우 위에 치즈와 토핑을 올려 구운 음식", "related": ["pizzeria"]}',
  '{"korean_phrase": "피자 → 그대로 피자! 치즈가 쭉 늘어나는 그 피자", "story": "한국어 피자와 발음이 거의 같아요. 피(pi) + 자(za)로 나눠 기억하세요."}',
  '{}'),

('water', 'n.', '물', '/ˈwɔːtər/',
  '{"parts": [{"text": "wat", "meaning": "고대영어 wæter, 물"}, {"text": "er", "meaning": "명사 어미"}], "gloss": "생명 유지에 필수적인 액체", "related": ["waterfall", "waterproof", "underwater"]}',
  '{"korean_phrase": "워터 → 워(와!) 터(터졌다!) 물이 터졌다!", "story": "수도관이 \"와!\" 하고 터져서 물(water)이 콸콸 쏟아지는 장면을 상상하세요."}',
  '{}'),

('help', 'n.', '도움', '/hɛlp/',
  '{"parts": [{"text": "help", "meaning": "고대영어 helpan, 돕다"}], "gloss": "어려움을 해결해주는 행위", "related": ["helpful", "helpless", "helper"]}',
  '{"korean_phrase": "헬프 → 헬(hell, 지옥)에서 프(풀어)달라고 도움을 요청", "story": "지옥(hell)에 빠진 사람이 \"풀어줘!\" 하고 도움(help)을 외치는 장면."}',
  '{}');
