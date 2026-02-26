import { useState, useEffect } from "react";
import { Input } from "./input";
import { Label } from "./label";
import { CalendarBlank } from "@phosphor-icons/react";

/**
 * DateInput - A manual date input component that replaces calendar popovers
 * Supports both display format (DD/MM/YYYY) and ISO format (YYYY-MM-DD)
 */
export function DateInput({ 
  value, 
  onChange, 
  label,
  placeholder = "DD/MM/YYYY",
  className = "",
  disabled = false,
  required = false,
  "data-testid": testId
}) {
  // Convert Date object or ISO string to display format
  const formatForDisplay = (dateValue) => {
    if (!dateValue) return "";
    
    try {
      const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
      if (isNaN(date.getTime())) return "";
      
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return "";
    }
  };

  // Parse display format (DD/MM/YYYY) to Date object
  const parseDisplayFormat = (displayValue) => {
    if (!displayValue) return null;
    
    // Try DD/MM/YYYY format
    const parts = displayValue.split('/');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      
      if (!isNaN(day) && !isNaN(month) && !isNaN(year) && year > 1900 && year < 2100) {
        const date = new Date(year, month, day);
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
    }
    
    // Try ISO format YYYY-MM-DD
    const isoDate = new Date(displayValue);
    if (!isNaN(isoDate.getTime())) {
      return isoDate;
    }
    
    return null;
  };

  const [inputValue, setInputValue] = useState(formatForDisplay(value));

  // Update input when value prop changes
  useEffect(() => {
    setInputValue(formatForDisplay(value));
  }, [value]);

  const handleChange = (e) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    
    // Try to parse and call onChange if valid
    const parsedDate = parseDisplayFormat(newValue);
    if (parsedDate) {
      onChange(parsedDate);
    }
  };

  const handleBlur = () => {
    // On blur, try to parse and format
    const parsedDate = parseDisplayFormat(inputValue);
    if (parsedDate) {
      setInputValue(formatForDisplay(parsedDate));
      onChange(parsedDate);
    }
  };

  // Also support native date input as fallback
  const handleNativeDateChange = (e) => {
    const isoValue = e.target.value;
    if (isoValue) {
      const date = new Date(isoValue + "T12:00:00");
      setInputValue(formatForDisplay(date));
      onChange(date);
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {label && <Label>{label}</Label>}
      <div className="relative">
        <CalendarBlank 
          size={16} 
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" 
        />
        <Input
          type="text"
          value={inputValue}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          className="pl-10"
          data-testid={testId}
        />
        {/* Hidden native date input for mobile users */}
        <input
          type="date"
          onChange={handleNativeDateChange}
          className="absolute inset-0 opacity-0 cursor-pointer"
          disabled={disabled}
        />
      </div>
    </div>
  );
}

/**
 * DateRangeInput - Two date inputs for a range
 */
export function DateRangeInput({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  startLabel = "Fecha Inicio",
  endLabel = "Fecha Fin",
  className = ""
}) {
  return (
    <div className={`grid grid-cols-2 gap-4 ${className}`}>
      <DateInput
        value={startDate}
        onChange={onStartDateChange}
        label={startLabel}
      />
      <DateInput
        value={endDate}
        onChange={onEndDateChange}
        label={endLabel}
      />
    </div>
  );
}

export default DateInput;
