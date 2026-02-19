"use client";

import { useEffect } from "react";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";

export function TutorialGuide() {
  useEffect(() => {
    // Projeyi canlıya alırken alttaki satırı açıp, 'false' olanı silmeyi unutma
    // const hasSeenTutorial = localStorage.getItem("tutorial-completed");
    const hasSeenTutorial = false; // Test modu
    
    if (hasSeenTutorial) return;

    const driverObj = driver({
      showProgress: true,
      animate: true,
      allowClose: true, // Sağ üstte X çıkar, tıklayınca kapanır
      doneBtnText: "Finish",
      nextBtnText: "Next",
      prevBtnText: "Back",
      
      steps: [
        // 1. Hoşgeldiniz
        {
          popover: {
            title: "Welcome to DeepStackers! 👋",
            description: "Let's take a quick tour. You can exit anytime by clicking the 'X' button.",
          },
        },
        // 2. Sidebar Toggle (Menü Açma)
        {
          element: "#sidebar-toggle",
          popover: {
            title: "Navigation",
            description: "Click here to open the menu.",
            side: "right",
            align: "start",
            showButtons: [], // İleri butonunu gizleyip tıklamaya zorluyoruz
          },
          onHighlightStarted: (element) => {
            if (!element) return;
            element.addEventListener("click", () => {
              // Menü açılma animasyonunu bekleyip ilerle
              setTimeout(() => driverObj.moveNext(), 400); 
            }, { once: true });
          },
        },
        // 3. Menü Aksiyonları
        {
          element: "#sidebar-actions-group",
          popover: {
            title: "Actions Menu",
            description: "Start new chats, search, or change settings here.",
            side: "right",
            align: "start",
          },
        },
        // 4. Sohbet Geçmişi
        {
          element: "#sidebar-history-list",
          popover: {
            title: "Chat History",
            description: "Your past conversations are saved here.",
            side: "right",
            align: "start",
          },
        },
        // 5. Chat Input (Son Adım - Sadece Tanıtım)
        {
          element: "#chat-input-area",
          popover: {
            title: "Start Chatting 🚀",
            description: "Type your questions here and press Enter to interact with your AI assistant. Enjoy!",
            side: "top",
            align: "center",
            // Burası son adım olduğu için otomatik olarak "Finish" butonu çıkacaktır.
          },
        }
      ],
      onDestroyStarted: () => {
        // Kullanıcı turu bitirdiğinde veya çarpıya basıp çıktığında kaydet
        localStorage.setItem("tutorial-completed", "true");
        driverObj.destroy();
      },
    });

    driverObj.drive();
  }, []);

  return null;
}