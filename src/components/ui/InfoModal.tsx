"use client";

import { ReactNode, useState } from "react";
import { Info, HelpCircle, BookOpen, Calculator } from "lucide-react";
import { Modal } from "./Modal";

interface InfoSection {
  title?: string;
  content: ReactNode;
}

interface InfoModalProps {
  title: string;
  description: ReactNode;
  formula?: {
    label: string;
    expression: string;
    variables?: Array<{ name: string; description: string }>;
  };
  examples?: Array<{
    label: string;
    description: string;
    result?: string;
  }>;
  sections?: InfoSection[];
  interpretation?: Array<{
    value: string;
    meaning: string;
    color?: string;
  }>;
  triggerClassName?: string;
  iconSize?: number;
}

/**
 * InfoModal - Reusable component for explaining features and calculations
 * Triggered by clicking an info icon, shows detailed explanation with
 * optional formula, examples, and interpretation guide.
 */
export function InfoModal({
  title,
  description,
  formula,
  examples,
  sections,
  interpretation,
  triggerClassName = "",
  iconSize = 18,
}: InfoModalProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={`flex items-center justify-center p-1.5 rounded-md text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 ${triggerClassName}`}
        aria-label={`Learn more about ${title}`}
      >
        <Info size={iconSize} />
      </button>

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title={title} size="lg">
        <div className="space-y-5">
          {/* Description */}
          <div className="text-gray-300 text-sm leading-relaxed">
            {description}
          </div>

          {/* Formula Section */}
          {formula && (
            <div className="bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border border-blue-500/20 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Calculator className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-semibold text-blue-400">{formula.label}</span>
              </div>
              <code className="block bg-[#0a0a0a] rounded-md px-4 py-3 text-sm text-amber-300 font-mono overflow-x-auto">
                {formula.expression}
              </code>
              {formula.variables && formula.variables.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  {formula.variables.map((v, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <code className="text-amber-300/80 font-mono text-xs bg-black/30 px-1.5 py-0.5 rounded">
                        {v.name}
                      </code>
                      <span className="text-gray-400">{v.description}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Examples Section */}
          {examples && examples.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <BookOpen className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-semibold text-emerald-400">Examples</span>
              </div>
              <div className="space-y-2">
                {examples.map((example, i) => (
                  <div key={i} className="bg-[#222] border border-[#333] rounded-lg p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="text-sm font-medium text-white">{example.label}</span>
                        <p className="text-sm text-gray-400 mt-0.5">{example.description}</p>
                      </div>
                      {example.result && (
                        <span className="text-sm font-bold text-emerald-400 flex-shrink-0">
                          {example.result}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Interpretation Guide */}
          {interpretation && interpretation.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <HelpCircle className="w-4 h-4 text-purple-400" />
                <span className="text-sm font-semibold text-purple-400">How to Interpret</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {interpretation.map((item, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 bg-[#222] border border-[#333] rounded-lg px-3 py-2"
                  >
                    <span
                      className={`text-sm font-bold min-w-[60px] ${
                        item.color || "text-white"
                      }`}
                    >
                      {item.value}
                    </span>
                    <span className="text-sm text-gray-400">{item.meaning}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Additional Sections */}
          {sections && sections.map((section, i) => (
            <div key={i}>
              {section.title && (
                <h4 className="text-sm font-semibold text-gray-300 mb-2">{section.title}</h4>
              )}
              <div className="text-sm text-gray-400">
                {section.content}
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </>
  );
}

/**
 * Standalone info button that shows a simple tooltip-style info
 * For quick explanations without a full modal
 */
export function InfoTooltip({
  content,
  iconSize = 16,
  className = "",
}: {
  content: string;
  iconSize?: number;
  className?: string;
}) {
  return (
    <div className={`group relative inline-flex ${className}`}>
      <button
        className="p-1 text-gray-500 hover:text-gray-300 transition-colors"
        aria-label="More information"
      >
        <Info size={iconSize} />
      </button>
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-2.5 bg-[#222] border border-[#333] rounded-lg text-xs text-gray-400 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20 shadow-xl">
        {content}
        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-[#333]" />
      </div>
    </div>
  );
}
