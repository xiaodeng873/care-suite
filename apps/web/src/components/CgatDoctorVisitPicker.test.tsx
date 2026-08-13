import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import CgatDoctorVisitPicker from './CgatDoctorVisitPicker';

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        order: () => Promise.resolve({ data: [], error: null }),
      }),
    }),
  },
}));

describe('CgatDoctorVisitPicker', () => {
  it('renders without crashing and shows the title', () => {
    const html = renderToString(
      React.createElement(CgatDoctorVisitPicker, {
        usedCountByDate: {},
        onSelect: () => {},
        onScheduleChanged: () => {},
        onClose: () => {},
      })
    );
    expect(html).toContain('CGAT到診日期');
  });
});
