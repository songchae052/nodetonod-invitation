import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Home() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const navigate = useNavigate();

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      // Submit to Google Sheets API
      await fetch('/api/submit-rsvp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, phone }),
      });
    } catch (error) {
      console.error('Failed to submit RSVP:', error);
      // Continue navigation even if submission fails
    }
    
    // Navigate to the invitation page with query parameters
    const params = new URLSearchParams();
    params.set('name', name);
    if (phone) params.set('phone', phone);
    
    navigate(`/invitation?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 space-y-8 border border-neutral-100">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900">Node to Nod</h1>
          <p className="text-neutral-500">초대장을 생성하세요</p>
        </div>

        <form onSubmit={handleGenerate} className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="name" className="block text-sm font-medium text-neutral-700">
              이름 (닉네임)
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-neutral-200 focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 outline-none transition-all placeholder:text-neutral-400"
              placeholder="받는 분의 이름을 입력하세요"
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="phone" className="block text-sm font-medium text-neutral-700">
              전화번호
            </label>
            <input
              type="tel"
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-neutral-200 focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 outline-none transition-all placeholder:text-neutral-400"
              placeholder="010-0000-0000"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-neutral-900 text-white font-medium py-3.5 rounded-lg hover:bg-neutral-800 active:scale-[0.98] transition-all duration-200 shadow-lg shadow-neutral-900/10"
          >
            초대장 생성하기
          </button>
        </form>
      </div>
    </div>
  );
}
