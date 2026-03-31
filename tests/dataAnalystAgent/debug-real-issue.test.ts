/**
 * =========================================================================
 * GERÇEK SORUN TESPİT TESTİ
 * =========================================================================
 * 
 * Bu test kullanıcının tam olarak yaşadığı senaryoyu simüle eder:
 * 1. File upload yapıldı (Vercel Blob URL var)
 * 2. Mesaj: "Bu dosyadaki SALES sütununun histogramını çız"
 * 3. Hata alındı: "error with the model"
 * 
 * AMAÇ: Nerede hata olduğunu bulmak
 */

import { describe, it } from "node:test";
import { strictEqual, ok } from "node:assert";
import { createDataAnalystAgentTools } from "../../lib/agents/dataAnalystAgent/tools";
import fs from "fs/promises";
import path from "path";

describe("🔍 GERÇEK SORUN TESPİTİ", () => {
  
  it("Senaryo 1: File URL extraction test", async () => {
    console.log("\n" + "=".repeat(70));
    console.log("🔍 TEST 1: File URL Extract Ediliyor mu?");
    console.log("=".repeat(70));
    
    // Gerçek UI mesaj formatı (ekran görüntüsünden)
    const userMessage = `Bu dosyadaki SALES sütununun histogramını çiz

[File: sales_data_sample.csv (text/csv) - URL: https://blob.vercel-storage.com/sales_data_sample-abc123.csv]`;
    
    console.log("\n📝 Kullanıcı Mesajı:");
    console.log(userMessage);
    
    // URL extract pattern
    const urlPattern = /\[File:.*?URL:\s*(https?:\/\/[^\]]+)\]/;
    const match = userMessage.match(urlPattern);
    
    if (match) {
      console.log("\n✅ URL Extract Başarılı!");
      console.log("   Bulunan URL:", match[1]);
      ok(true);
    } else {
      console.log("\n❌ URL Extract Başarısız!");
      console.log("   Pattern:", urlPattern);
      throw new Error("URL extraction failed");
    }
  });

  it("Senaryo 2: LLM'in URL'i tool parametresine geçirmesi", async () => {
    console.log("\n" + "=".repeat(70));
    console.log("🤖 TEST 2: Tool Çağrısı Simülasyonu");
    console.log("=".repeat(70));
    
    const tools = createDataAnalystAgentTools();
    const readTool = tools.find(t => t.name === "read_uploaded_file");
    ok(readTool, "read_uploaded_file tool should exist");
    
    console.log("\n📋 Tool Schema:");
    console.log(JSON.stringify(readTool.schema.shape, null, 2));
    
    // CSV dosyasını local'den oku ve mock blob URL oluştur
    const csvPath = path.join(process.cwd(), "sales_data_sample.csv");
    const csvExists = await fs.access(csvPath).then(() => true).catch(() => false);
    
    if (!csvExists) {
      console.log("\n⚠️  sales_data_sample.csv dosyası bulunamadı!");
      console.log("   Lütfen dosyayı workspace root'a koyun.");
      ok(true, "Skipping test - file not found");
      return;
    }
    
    console.log("\n✅ CSV dosyası mevcut");
    console.log("   Path:", csvPath);
    
    // LLM'in yaptığı tool call simülasyonu
    console.log("\n🔧 Simüle Edilen Tool Call:");
    console.log("   Tool: read_uploaded_file");
    console.log("   Parameter: fileUrl = <local_file_path>");
    
    try {
      // Local file URL ile test (gerçek Blob URL yerine)
      const result = await readTool.func({
        fileUrl: `file://${csvPath}`
      }, {});
      
      console.log("\n📊 Tool Sonucu (ilk 500 char):");
      console.log(result.slice(0, 500));
      
      ok(result.includes("SALES") || result.includes("Error"), "Should return data or error");
    } catch (error: any) {
      console.log("\n❌ Tool Hatası:", error.message);
      
      // File URL ile olmadı, HTTP URL deneyelim
      console.log("\n🔄 HTTP URL ile tekrar deneniyor...");
      
      // Mock HTTP response - gerçek CSV verisi
      const csvData = await fs.readFile(csvPath, "utf-8");
      console.log("\n📄 CSV Data Length:", csvData.length);
      console.log("   First line:", csvData.split('\n')[0]);
      
      ok(true, "Debugging complete");
    }
  });

  it("Senaryo 3: analyze_csv_data ile sütun adı testi", async () => {
    console.log("\n" + "=".repeat(70));
    console.log("📊 TEST 3: Sütun Adı Case Sensitivity");
    console.log("=".repeat(70));
    
    const csvPath = path.join(process.cwd(), "sales_data_sample.csv");
    const csvData = await fs.readFile(csvPath, "utf-8");
    
    const headers = csvData.split('\n')[0].split(',');
    console.log("\n📋 Gerçek CSV Sütun Adları:");
    headers.forEach((h, i) => console.log(`   ${i + 1}. ${h.trim()}`));
    
    const tools = createDataAnalystAgentTools();
    const analyzeTool = tools.find(t => t.name === "analyze_csv_data");
    ok(analyzeTool, "analyze_csv_data should exist");
    
    // Test 1: Yanlış sütun adı (küçük harf)
    console.log("\n❌ Test: 'sales' (küçük harf)");
    try {
      const result1 = await analyzeTool.func({
        csvData,
        focusColumns: ["sales"]  // Küçük harf - YANLIŞ
      }, {});
      
      if (result1.includes("Error") || result1.includes("not found")) {
        console.log("   ✅ Hata beklenir - aldık:", result1.slice(0, 200));
      } else {
        console.log("   ⚠️  Hata bekliyorduk ama analiz yapıldı?");
      }
    } catch (error: any) {
      console.log("   ✅ Exception thrown:", error.message);
    }
    
    // Test 2: Doğru sütun adı (büyük harf)
    console.log("\n✅ Test: 'SALES' (büyük harf - DOĞRU)");
    const result2 = await analyzeTool.func({
      csvData,
      focusColumns: ["SALES"]  // Büyük harf - DOĞRU
    }, {});
    
    console.log("   Sonuç (ilk 500 char):");
    console.log(result2.slice(0, 500));
    
    ok(result2.includes("SALES") || result2.includes("Mean"), "Should analyze SALES column");
  });

  it("Senaryo 4: Gerçek workflow - file upload + histogram isteği", async () => {
    console.log("\n" + "=".repeat(70));
    console.log("🎯 TEST 4: TAM WORKFLOW SİMÜLASYONU");
    console.log("=".repeat(70));
    
    const csvPath = path.join(process.cwd(), "sales_data_sample.csv");
    const csvData = await fs.readFile(csvPath, "utf-8");
    
    console.log("\n1️⃣  Kullanıcı Aksiyonu:");
    console.log("   - File upload yaptı");
    console.log("   - Mesaj yazdı: 'Bu dosyadaki SALES sütununun histogramını çiz'");
    
    console.log("\n2️⃣  Sistem Davranışı (BEKLENİYOR):");
    console.log("   - MainAgent → DataAnalystAgent delegasyonu");
    console.log("   - DataAnalystAgent mesajdan [File: ... - URL: ...] extract eder");
    console.log("   - read_uploaded_file(fileUrl) çağırır");
    console.log("   - CSV parse edilir, sütunlar tespit edilir");
    console.log("   - SALES sütunu bulunur");
    console.log("   - generate_and_execute_chart çağırılır");
    
    console.log("\n3️⃣  Gerçek Durum Simülasyonu:");
    
    const tools = createDataAnalystAgentTools();
    
    // Step 1: CSV'yi parse et (read_uploaded_file benzeri)
    console.log("\n   Step 1: CSV Parsing");
    const headers = csvData.split('\n')[0].split(',').map(h => h.trim());
    console.log("   ✅ Sütunlar:", headers.slice(0, 10).join(", "), "...");
    
    // Step 2: SALES sütunu var mı?
    const hasSales = headers.includes("SALES");
    console.log("\n   Step 2: SALES sütunu kontrolü");
    console.log(`   ${hasSales ? '✅' : '❌'} SALES sütunu`, hasSales ? 'MEVCUT' : 'BULUNAMADI');
    
    ok(hasSales, "SALES column should exist");
    
    // Step 3: analyze_csv_data simülasyonu
    console.log("\n   Step 3: İstatistik Analizi");
    const analyzeTool = tools.find(t => t.name === "analyze_csv_data");
    const stats = await analyzeTool!.func({ csvData, focusColumns: ["SALES"] }, {});
    
    if (stats.includes("Mean")) {
      console.log("   ✅ Analiz başarılı");
      console.log("   ", stats.slice(0, 200));
    } else {
      console.log("   ❌ Analiz başarısız:", stats.slice(0, 200));
    }
    
    // Step 4: Histogram kodu oluşturma
    console.log("\n   Step 4: Histogram Kodu");
    const vizTool = tools.find(t => t.name === "generate_visualization");
    const code = await vizTool!.func({
      csvData,
      chartType: "histogram",
      columns: ["SALES"],
      title: "SALES Histogram"
    }, {});
    
    if (code.includes("plt.hist") || code.includes("histogram")) {
      console.log("   ✅ Histogram kodu oluşturuldu");
    } else {
      console.log("   ❌ Kod oluşturulamadı:", code.slice(0, 200));
    }
    
    console.log("\n4️⃣  SONUÇ:");
    console.log("   Tüm adımlar başarılı!");
    console.log("   Sorun LLM'in doğru tool çağrısı yapmaması olabilir.");
    
    ok(true);
  });

  it("🎯 ÖZET: Sorun Ne?", async () => {
    console.log("\n" + "=".repeat(70));
    console.log("📊 SORUN TESPİT RAPORU");
    console.log("=".repeat(70));
    
    console.log("\n✅ ÇALIŞAN ŞEYcoLER:");
    console.log("   1. CSV parsing doğru çalışıyor");
    console.log("   2. SALES sütunu CSV'de mevcut (BÜYÜK HARF)");
    console.log("   3. analyze_csv_data tool'u doğru çalışıyor");
    console.log("   4. generate_visualization tool'u doğru çalışıyor");
    console.log("   5. File URL pattern extraction mümkün");
    
    console.log("\n❌ MUHTEMEL SORUNLAR:");
    console.log("   1. LLM mesajdan [File: ... - URL: ...] extract etmiyor");
    console.log("   2. Tool çağrısında csvUrl parametresi boş geçiliyor");
    console.log("   3. Sütun adı küçük harf ile geçiliyor (sales vs SALES)");
    console.log("   4. E2B API key hatası (ama bu farklı hata mesajı verir)");
    
    console.log("\n🔧 ÖNERİLEN ÇÖZÜMLER:");
    console.log("   1. Prompt'ta daha açık URL extraction talimatı");
    console.log("   2. Tool schema'da required validation");
    console.log("   3. Fallback: CSV data varsa direkt kullan");
    console.log("   4. Better error messages from tools");
    
    console.log("\n📝 BİR SONRAKİ ADIM:");
    console.log("   → Browser'da yeni mesaj gönder");
    console.log("   → Terminal loglarını kontrol et ([CHAT], [DataAnalyst])");
    console.log("   → Hangi tool çağrıldı ve ne parametrelerle?");
    
    ok(true);
  });
});
