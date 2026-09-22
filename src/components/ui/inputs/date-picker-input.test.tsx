import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DatePickerInput } from './date-picker-input';

describe('DatePickerInput', () => {
  it('emits Date values by default', () => {
    const handleChange = vi.fn();

    render(
      <DatePickerInput
        aria-label="Ngày vào làm"
        value={null}
        onChange={handleChange}
      />,
    );

    fireEvent.change(screen.getByRole('textbox', { name: 'Ngày vào làm' }), {
      target: { value: '20/06/2026' },
    });

    expect(handleChange).toHaveBeenCalledWith(new Date(2026, 5, 20));
  });

  it('emits ISO date strings in iso-date mode', () => {
    const handleChange = vi.fn();

    render(
      <DatePickerInput
        aria-label="Hạn dùng"
        value="2026-12-31"
        valueMode="iso-date"
        onChange={handleChange}
      />,
    );

    expect(screen.getByRole('textbox', { name: 'Hạn dùng' })).toHaveValue(
      '31/12/2026',
    );

    fireEvent.change(screen.getByRole('textbox', { name: 'Hạn dùng' }), {
      target: { value: '20/06/2026' },
    });

    expect(handleChange).toHaveBeenCalledWith('2026-06-20');
  });

  it('keeps the current text while an existing date is edited', () => {
    const handleChange = vi.fn();

    render(
      <DatePickerInput
        aria-label="Ngày bắt đầu"
        value="2026-01-01"
        valueMode="iso-date"
        onChange={handleChange}
      />,
    );

    const input = screen.getByRole('textbox', { name: 'Ngày bắt đầu' });
    fireEvent.change(input, { target: { value: '01/011/2026' } });

    expect(input).toHaveValue('01/011/2026');
    expect(handleChange).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: '01/11/2026' } });

    expect(handleChange).toHaveBeenCalledWith('2026-11-01');
  });

  it('updates the open calendar when a valid date is typed', () => {
    render(
      <DatePickerInput
        aria-label="Ngày kết thúc"
        calendarLabel="Chọn ngày kết thúc"
        value="2026-08-17"
        valueMode="iso-date"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Chọn ngày kết thúc' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Ngày kết thúc' }), {
      target: { value: '01/12/2025' },
    });

    expect(
      document.querySelector('[data-day="2025-12-01"][data-selected]'),
    ).toBeInTheDocument();
  });

  it('opens the calendar popover from the input icon', () => {
    render(
      <DatePickerInput
        aria-label="Hạn dùng"
        calendarLabel="Chọn hạn dùng"
        value="2026-12-31"
        valueMode="iso-date"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Chọn hạn dùng' }));

    expect(screen.getByRole('grid')).toBeInTheDocument();
  });

  it('renders and updates a time input when showTime is enabled', () => {
    const handleTimeChange = vi.fn();

    render(
      <DatePickerInput
        aria-label="Ngày bắt đầu"
        timeLabel="Giờ bắt đầu"
        showTime
        timeValue="08:30"
        onTimeChange={handleTimeChange}
      />,
    );

    const timeInput = screen.getByLabelText('Giờ bắt đầu');
    expect(timeInput).toHaveValue('08:30');
    expect(timeInput).toHaveAttribute('type', 'text');
    expect(timeInput).toHaveAttribute('inputmode', 'numeric');
    expect(timeInput).toHaveAttribute('placeholder', 'HH:mm');

    fireEvent.change(timeInput, { target: { value: '09:45' } });

    expect(handleTimeChange).toHaveBeenCalledWith('09:45');
  });

  it('formats numeric time input as 24-hour HH:mm', () => {
    const handleTimeChange = vi.fn();

    render(
      <DatePickerInput
        aria-label="Ngày bắt đầu"
        timeLabel="Giờ bắt đầu"
        showTime
        onTimeChange={handleTimeChange}
      />,
    );

    fireEvent.change(screen.getByLabelText('Giờ bắt đầu'), {
      target: { value: '0945' },
    });

    expect(screen.getByLabelText('Giờ bắt đầu')).toHaveValue('09:45');
    expect(handleTimeChange).toHaveBeenCalledWith('09:45');
  });

  it('opens a scrollable hour and minute picker from the clock button', () => {
    const handleTimeChange = vi.fn();

    render(
      <DatePickerInput
        aria-label="Ngày bắt đầu"
        timeLabel="Giờ bắt đầu"
        showTime
        timeValue="08:30"
        onTimeChange={handleTimeChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Chọn giờ' }));

    expect(screen.queryByText('Chọn thời gian')).not.toBeInTheDocument();
    expect(screen.queryByText('Giờ', { exact: true })).not.toBeInTheDocument();
    expect(screen.queryByText('Phút', { exact: true })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Giờ 08' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Phút 30' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Giờ 18' }));
    fireEvent.click(screen.getByRole('button', { name: 'Phút 45' }));

    expect(handleTimeChange).toHaveBeenLastCalledWith('18:45');
  });

  it('sets the current time or clears the time from the picker actions', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 20, 14, 7));

    try {
      const handleTimeChange = vi.fn();

      render(
        <DatePickerInput
          aria-label="Ngày bắt đầu"
          timeLabel="Giờ bắt đầu"
          showTime
          timeValue="08:30"
          onTimeChange={handleTimeChange}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Chọn giờ' }));
      fireEvent.click(screen.getByRole('button', { name: 'Xóa' }));
      expect(handleTimeChange).toHaveBeenLastCalledWith('');

      fireEvent.click(screen.getByRole('button', { name: 'Chọn giờ' }));
      fireEvent.click(screen.getByRole('button', { name: 'Hiện tại' }));
      expect(handleTimeChange).toHaveBeenLastCalledWith('14:07');
    } finally {
      vi.useRealTimers();
    }
  });
});
