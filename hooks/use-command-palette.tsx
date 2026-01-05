"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";

interface CommandPaletteContextType {
    open: boolean;
    setOpen: React.Dispatch<React.SetStateAction<boolean>>;
    toggle: () => void;
}

const CommandPaletteContext = createContext<CommandPaletteContextType | undefined>(undefined);

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
    const [open, setOpen] = useState(false);

    const toggle = useCallback(() => {
        setOpen((prev) => !prev);
    }, []);

    return (
        <CommandPaletteContext.Provider value={{ open, setOpen, toggle }}>
            {children}
        </CommandPaletteContext.Provider>
    );
}

export function useCommandPalette(): CommandPaletteContextType {
    const context = useContext(CommandPaletteContext);
    if (!context) {
        throw new Error("useCommandPalette must be used within a CommandPaletteProvider");
    }
    return context;
}
