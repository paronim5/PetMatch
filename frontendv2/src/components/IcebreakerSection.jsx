import React, { useState, useEffect } from 'react';
import { userService } from '../services/user';
import { FaPlus, FaTimes, FaSave } from 'react-icons/fa';

const cardCls = 'bg-gray-900 border border-gray-800 rounded-2xl p-5';
const inputCls = 'w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:border-violet-500 transition-all';

const IcebreakerSection = () => {
  const [prompts, setPrompts] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState([]);
  const [saving, setSaving] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    userService.getIcebreakerPrompts().then(setPrompts).catch(() => {});
    userService.getMyIcebreakerAnswers().then(setAnswers).catch(() => {});
  }, []);

  const startEdit = () => {
    setDraft(answers.map(a => ({ prompt_id: a.prompt_id, prompt_text: a.prompt_text, answer_text: a.answer_text })));
    setEditing(true);
  };

  const addPrompt = (prompt) => {
    if (draft.length >= 3) return;
    if (draft.find(d => d.prompt_id === prompt.id)) return;
    setDraft(prev => [...prev, { prompt_id: prompt.id, prompt_text: prompt.prompt_text, answer_text: '' }]);
    setShowPicker(false);
  };

  const removePrompt = (idx) => setDraft(prev => prev.filter((_, i) => i !== idx));

  const updateAnswer = (idx, text) => setDraft(prev => prev.map((d, i) => i === idx ? { ...d, answer_text: text } : d));

  const save = async () => {
    setSaving(true);
    try {
      const payload = draft.filter(d => d.answer_text.trim()).map((d, i) => ({
        prompt_id: d.prompt_id,
        answer_text: d.answer_text,
        display_order: i,
      }));
      const saved = await userService.saveIcebreakerAnswers(payload);
      setAnswers(saved);
      setEditing(false);
    } catch (err) {
      console.error('Failed to save icebreakers:', err);
    } finally {
      setSaving(false);
    }
  };

  const unusedPrompts = prompts.filter(p => !draft.find(d => d.prompt_id === p.id));

  return (
    <div className={cardCls}>
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-white">Icebreaker Prompts</h3>
        {!editing ? (
          <button onClick={startEdit} className="text-xs text-violet-400 hover:text-violet-300 font-semibold transition-colors">
            {answers.length ? 'Edit' : 'Add Prompts'}
          </button>
        ) : (
          <button onClick={save} disabled={saving} className="flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 font-semibold transition-colors disabled:opacity-50">
            <FaSave size={11} /> {saving ? 'Saving...' : 'Save'}
          </button>
        )}
      </div>

      {!editing ? (
        answers.length === 0 ? (
          <p className="text-gray-500 text-sm">Add up to 3 fun prompts to show on your profile.</p>
        ) : (
          <div className="space-y-3">
            {answers.map(a => (
              <div key={a.id} className="bg-gray-800 rounded-xl p-3">
                <p className="text-violet-400 text-xs font-semibold mb-1">{a.prompt_text}</p>
                <p className="text-white text-sm">{a.answer_text}</p>
              </div>
            ))}
          </div>
        )
      ) : (
        <div className="space-y-3">
          {draft.map((d, idx) => (
            <div key={d.prompt_id} className="bg-gray-800 rounded-xl p-3 relative">
              <button onClick={() => removePrompt(idx)} className="absolute top-2 right-2 text-gray-500 hover:text-red-400 transition-colors">
                <FaTimes size={12} />
              </button>
              <p className="text-violet-400 text-xs font-semibold mb-2 pr-4">{d.prompt_text}</p>
              <input
                className={inputCls}
                placeholder="Your answer..."
                value={d.answer_text}
                onChange={e => updateAnswer(idx, e.target.value)}
                maxLength={200}
              />
            </div>
          ))}

          {draft.length < 3 && (
            <div className="relative">
              <button
                onClick={() => setShowPicker(!showPicker)}
                className="flex items-center gap-2 text-sm text-violet-400 hover:text-violet-300 font-semibold transition-colors"
              >
                <FaPlus size={12} /> Add a prompt
              </button>
              {showPicker && (
                <div className="absolute top-8 left-0 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl z-20 max-h-56 overflow-y-auto w-72">
                  {unusedPrompts.map(p => (
                    <button
                      key={p.id}
                      onClick={() => addPrompt(p)}
                      className="w-full text-left px-4 py-3 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors border-b border-gray-700 last:border-0"
                    >
                      {p.prompt_text}
                    </button>
                  ))}
                  {unusedPrompts.length === 0 && <p className="px-4 py-3 text-gray-500 text-sm">No more prompts available.</p>}
                </div>
              )}
            </div>
          )}

          <button onClick={() => setEditing(false)} className="text-xs text-gray-500 hover:text-gray-400 transition-colors">Cancel</button>
        </div>
      )}
    </div>
  );
};

export default IcebreakerSection;
