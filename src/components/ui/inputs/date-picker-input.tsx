import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, ComponentProps, FocusEvent } from 'react';
import type { VariantProps } from 'class-variance-authority';
import { format, isValid, parse } from 'date-fns';
import { vi } from 'date-fns/locale';
import { CalendarDays, Clock3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input, type inputVariants } from '@/components/ui/input';
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';

const DATE_INPUT_FORMAT = 'dd/MM/yyyy';
const ISO_DATE_FORMAT = 'yyyy-MM-dd';
const TIME_INPUT_FORMAT = 'HH:mm';
const TIME_HOURS = Array.from({ length: 24 }, (_, index) => index);
const TIME_MINUTES = Array.from({ length: 60 }, (_, index) => index);
const DATE_INPUT_WIDTH_CLASSES = {
  auto: 'w-full',
  sm: 'w-40',
  md: 'w-48',
  lg: 'w-56',
} as const;
const DATE_TIME_INPUT_WIDTH_CLASSES = {
  auto: 'grid-cols-[minmax(0,1fr)_5.5rem]',
  sm: 'grid-cols-[minmax(0,10rem)_5.5rem]',
  md: 'grid-cols-[minmax(0,12rem)_5.5rem]',
  lg: 'grid-cols-[minmax(0,14rem)_5.5rem]',
} as const;
const DATE_TIME_WRAPPER_WIDTH_CLASSES = {
  auto: 'w-full',
  sm: 'w-fit max-w-full',
  md: 'w-fit max-w-full',
  lg: 'w-fit max-w-full',
} as const;

function formatDateInput(date: Date | null | undefined): string {
  if (!date || !isValid(date)) return '';
  return format(date, DATE_INPUT_FORMAT);
}

function parseIsoDate(value: string | null | undefined): Date | undefined {
  if (!value) return undefined;

  const parsedDate = parse(value, ISO_DATE_FORMAT, new Date());
  if (!isValid(parsedDate) || format(parsedDate, ISO_DATE_FORMAT) !== value) {
    return undefined;
  }

  return parsedDate;
}

function parseDateInput(value: string): Date | undefined {
  const trimmedValue = value.trim();
  if (!trimmedValue) return undefined;

  const parsedDate = parse(trimmedValue, DATE_INPUT_FORMAT, new Date());
  if (
    !isValid(parsedDate) ||
    format(parsedDate, DATE_INPUT_FORMAT) !== trimmedValue
  ) {
    return undefined;
  }

  return parsedDate;
}

function normalizeTimeInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;

  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

function isValidTimeInput(value: string): boolean {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function formatTimeValue(value: string): string {
  const match = value.trim().match(/^(\d{1,2}):(\d{1,2})/);
  if (match) {
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    const formattedValue = `${String(hours).padStart(2, '0')}:${String(
      minutes,
    ).padStart(2, '0')}`;

    return isValidTimeInput(formattedValue) ? formattedValue : '';
  }

  const normalizedValue = normalizeTimeInput(value);
  return isValidTimeInput(normalizedValue) ? normalizedValue : '';
}

function scrollTimeOptionIntoView(option: HTMLButtonElement | undefined) {
  if (!option) return;

  const viewport = option.closest<HTMLElement>(
    '[data-radix-scroll-area-viewport]',
  );
  if (!viewport) return;

  viewport.scrollTop = Math.max(
    0,
    option.offsetTop - (viewport.clientHeight - option.offsetHeight) / 2,
  );
}

export interface DatePickerInputProps
  extends
    Omit<
      ComponentProps<typeof Input>,
      'onBlur' | 'onChange' | 'type' | 'value'
    >,
    VariantProps<typeof inputVariants> {
  value?: Date | string | null;
  valueMode?: 'date' | 'iso-date';
  onChange?: (value: Date | string | undefined) => void;
  onBlur?: (event?: FocusEvent<HTMLInputElement>) => void;
  /** Width preset for the date input, or its column when time is displayed. */
  dateInputWidth?: keyof typeof DATE_INPUT_WIDTH_CLASSES;
  calendarLabel?: string;
  showTime?: boolean;
  timeValue?: string;
  onTimeChange?: (value: string) => void;
  onTimeBlur?: (event: FocusEvent<HTMLInputElement>) => void;
  timeLabel?: string;
}

export function DatePickerInput({
  className,
  value,
  valueMode = 'date',
  onChange,
  onBlur,
  variant,
  dateInputWidth = 'auto',
  placeholder = DATE_INPUT_FORMAT,
  calendarLabel = 'Chọn ngày',
  showTime = false,
  timeValue = '',
  onTimeChange,
  onTimeBlur,
  timeLabel,
  ...props
}: DatePickerInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedDate = useMemo(
    () =>
      valueMode === 'iso-date'
        ? parseIsoDate(typeof value === 'string' ? value : undefined)
        : value instanceof Date && isValid(value)
          ? value
          : undefined,
    [value, valueMode],
  );
  const [dateText, setDateText] = useState(() => formatDateInput(selectedDate));
  const [calendarDate, setCalendarDate] = useState<Date | undefined>(
    selectedDate,
  );
  const [timeText, setTimeText] = useState(() => formatTimeValue(timeValue));
  const [isTimeOpen, setIsTimeOpen] = useState(false);
  const hourOptionRefs = useRef(new Map<number, HTMLButtonElement>());
  const minuteOptionRefs = useRef(new Map<number, HTMLButtonElement>());

  useEffect(() => {
    setDateText(formatDateInput(selectedDate));
    setCalendarDate(selectedDate);
  }, [selectedDate]);

  useEffect(() => {
    setTimeText(formatTimeValue(timeValue));
  }, [timeValue]);

  const selectedTime = formatTimeValue(timeText) || '00:00';
  const [selectedHour, selectedMinute] = selectedTime.split(':').map(Number);

  useEffect(() => {
    if (!isTimeOpen) return;

    const frame = window.requestAnimationFrame(() => {
      scrollTimeOptionIntoView(hourOptionRefs.current.get(selectedHour));
      scrollTimeOptionIntoView(minuteOptionRefs.current.get(selectedMinute));
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isTimeOpen, selectedHour, selectedMinute]);

  const emitChange = (date: Date | undefined) => {
    if (valueMode === 'iso-date') {
      onChange?.(date ? format(date, ISO_DATE_FORMAT) : undefined);
      return;
    }

    onChange?.(date);
  };

  const handleTextChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.value;
    setDateText(nextValue);

    // Keep incomplete/temporarily invalid text local while the user is editing.
    // Emitting undefined here would update the controlled form value and cause
    // the input to reset before the user can finish typing the date.
    if (!nextValue.trim()) {
      setCalendarDate(undefined);
      emitChange(undefined);
      return;
    }

    const parsedDate = parseDateInput(nextValue);
    if (parsedDate) {
      setCalendarDate(parsedDate);
      emitChange(parsedDate);
    }
  };

  const handleBlur = (event: FocusEvent<HTMLInputElement>) => {
    onBlur?.(event);

    const parsedDate = parseDateInput(dateText);
    if (parsedDate) {
      setDateText(formatDateInput(parsedDate));
    }
  };

  const handleSelect = (date: Date | undefined) => {
    if (!date) return;

    setCalendarDate(date);
    emitChange(date);
    setDateText(formatDateInput(date));
    setIsOpen(false);
  };

  const handleTimeChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = normalizeTimeInput(event.target.value);
    setTimeText(nextValue);

    if (!nextValue || isValidTimeInput(nextValue)) {
      onTimeChange?.(nextValue);
    }
  };

  const handleTimeBlur = (event: FocusEvent<HTMLInputElement>) => {
    if (!timeText) {
      if (timeValue) onTimeChange?.('');
    } else if (!isValidTimeInput(timeText)) {
      setTimeText(formatTimeValue(timeValue));
    }

    onTimeBlur?.(event);
  };

  const handleTimePartChange = (part: 'hour' | 'minute', nextValue: number) => {
    const [currentHour, currentMinute] = selectedTime.split(':').map(Number);
    const nextTime = `${String(
      part === 'hour' ? nextValue : currentHour,
    ).padStart(2, '0')}:${String(
      part === 'minute' ? nextValue : currentMinute,
    ).padStart(2, '0')}`;

    setTimeText(nextTime);
    onTimeChange?.(nextTime);
  };

  const handleSetCurrentTime = () => {
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(
      now.getMinutes(),
    ).padStart(2, '0')}`;

    setTimeText(currentTime);
    onTimeChange?.(currentTime);
    setIsTimeOpen(false);
  };

  const handleClearTime = () => {
    setTimeText('');
    onTimeChange?.('');
    setIsTimeOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverAnchor asChild>
        <div
          className={cn(
            showTime
              ? DATE_TIME_WRAPPER_WIDTH_CLASSES[dateInputWidth]
              : DATE_INPUT_WIDTH_CLASSES[dateInputWidth],
            showTime && 'grid gap-2',
            showTime && DATE_TIME_INPUT_WIDTH_CLASSES[dateInputWidth],
          )}
        >
          <div className="relative min-w-0">
            <Input
              {...props}
              inputMode="numeric"
              placeholder={placeholder}
              value={dateText}
              variant={variant}
              className={cn('pe-9', className)}
              onBlur={handleBlur}
              onChange={handleTextChange}
            />
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label={calendarLabel}
                className={cn(
                  'absolute inset-y-px end-px inline-flex w-8 items-center justify-center rounded-e-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30',
                  !selectedDate && 'text-muted-foreground',
                )}
              >
                <CalendarDays className="size-4" />
              </button>
            </PopoverTrigger>
          </div>
          {showTime ? (
            <Popover open={isTimeOpen} onOpenChange={setIsTimeOpen}>
              <div className="relative min-w-0">
                <Input
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={5}
                  placeholder={TIME_INPUT_FORMAT}
                  variant={variant}
                  value={timeText}
                  aria-label={timeLabel ?? 'Giờ'}
                  aria-invalid={props['aria-invalid']}
                  className="pe-8 text-center tabular-nums"
                  onChange={handleTimeChange}
                  onBlur={handleTimeBlur}
                />
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    aria-label="Chọn giờ"
                    className="absolute inset-y-px end-px inline-flex w-8 items-center justify-center rounded-e-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                  >
                    <Clock3 className="size-3.5" />
                  </button>
                </PopoverTrigger>
              </div>
              <PopoverContent className="w-52 p-2" align="end" sideOffset={6}>
                <div className="mb-2 flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="flex-1 text-muted-foreground"
                    onClick={handleSetCurrentTime}
                  >
                    Hiện tại
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="flex-1 text-muted-foreground"
                    onClick={handleClearTime}
                  >
                    Xóa
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <ScrollArea className="h-48" viewportClassName="px-1">
                    <div className="space-y-0.5">
                      {TIME_HOURS.map((hour) => (
                        <button
                          key={hour}
                          ref={(element) => {
                            if (element) {
                              hourOptionRefs.current.set(hour, element);
                            } else {
                              hourOptionRefs.current.delete(hour);
                            }
                          }}
                          type="button"
                          data-selected={selectedHour === hour}
                          aria-label={`Giờ ${String(hour).padStart(2, '0')}`}
                          aria-pressed={selectedHour === hour}
                          className="h-7 w-full rounded-md px-2 text-xs tabular-nums text-foreground transition-colors hover:bg-accent data-[selected=true]:bg-primary data-[selected=true]:font-medium data-[selected=true]:text-primary-foreground data-[selected=true]:shadow-sm"
                          onClick={() => handleTimePartChange('hour', hour)}
                        >
                          {String(hour).padStart(2, '0')}
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                  <ScrollArea className="h-48" viewportClassName="px-1">
                    <div className="space-y-0.5">
                      {TIME_MINUTES.map((minute) => (
                        <button
                          key={minute}
                          ref={(element) => {
                            if (element) {
                              minuteOptionRefs.current.set(minute, element);
                            } else {
                              minuteOptionRefs.current.delete(minute);
                            }
                          }}
                          type="button"
                          data-selected={selectedMinute === minute}
                          aria-label={`Phút ${String(minute).padStart(2, '0')}`}
                          aria-pressed={selectedMinute === minute}
                          className="h-7 w-full rounded-md px-2 text-xs tabular-nums text-foreground transition-colors hover:bg-accent data-[selected=true]:bg-primary data-[selected=true]:font-medium data-[selected=true]:text-primary-foreground data-[selected=true]:shadow-sm"
                          onClick={() => handleTimePartChange('minute', minute)}
                        >
                          {String(minute).padStart(2, '0')}
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </PopoverContent>
            </Popover>
          ) : null}
        </div>
      </PopoverAnchor>
      <PopoverContent className="w-auto p-0" align="end">
        <Calendar
          key={calendarDate ? format(calendarDate, ISO_DATE_FORMAT) : 'empty'}
          mode="single"
          locale={vi}
          defaultMonth={calendarDate}
          selected={calendarDate}
          onSelect={handleSelect}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}
