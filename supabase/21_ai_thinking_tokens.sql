-- 思考 token：Gemini 2.5 Flash 會產生但原本沒被記到的計費量
-- Run in Supabase SQL Editor after 20_ai_usage.sql (safe to re-run)
--
-- 2.5 Flash 是思考模型，usageMetadata 除了 candidatesTokenCount 還有 thoughtsTokenCount，
-- 而後者是「按 output 費率計費」的。原本只記 candidates，等於把一大筆要付錢的 token
-- 當成不存在 —— 實測一次呼叫 prompt 616 / output 394，但 total 是 3675，差的 2665 全是思考。
--
-- 換算成錢是 $0.0012 對 $0.0078，低估 6.5 倍。一個用來防止成本失控的功能把成本低估
-- 這麼多，比沒有估計更危險：會讓人在已經花到上限時看到五分之一的數字。
alter table ai_usage add column if not exists thinking_tokens integer;

-- 回填既有資料：思考 token = 總量 - 輸入 - 輸出
update ai_usage
set thinking_tokens = greatest(0, total_tokens - coalesce(prompt_tokens, 0) - coalesce(output_tokens, 0))
where thinking_tokens is null
  and total_tokens is not null;
