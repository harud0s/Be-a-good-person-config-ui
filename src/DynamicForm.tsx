import React, { useEffect } from 'react';
import { useForm, useWatch, useFieldArray } from 'react-hook-form';
import type { Control, UseFormRegister, UseFormSetValue, FieldErrors } from 'react-hook-form';
import { ChevronDown, ChevronUp, ArrowUp, ArrowDown } from 'lucide-react';
import { zodResolver } from '@hookform/resolvers/zod';
import { getSchemaForForm, NUMERIC_KEYS, PRIMITIVE_ARRAY_KEYS, baseMetaSchema, getDefaultItemForArray } from './schemas';
import { useEditorStore } from './store';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { SortableArrayItem } from './components/SortableArrayItem';
import { toast } from 'sonner';

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input className={["flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base md:text-sm ring-offset-background file:border-0 file:bg-transparent file:text-base file:md:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50", className].filter(Boolean).join(" ")} ref={ref} {...props} />
));

const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(({ className, ...props }, ref) => (
  <button className={["inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 min-h-[44px] px-4 py-2", className].filter(Boolean).join(" ")} ref={ref} {...props} />
));

const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(({ className, ...props }, ref) => (
  <label className={["text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70", className].filter(Boolean).join(" ")} ref={ref} {...props} />
));

interface DynamicFormProps {
  filename?: string;
  isItem?: boolean;
  isMeta?: boolean;
  data: any;
  meta?: any;
  onSave: (data: any) => void;
  onDirtyChange?: (isDirty: boolean) => void;
}

function getPolymorphicController(name: string, parentData: any, meta: any) {
  if (!parentData) return null;
  
  const directController = `${name}_type`;
  if (Object.prototype.hasOwnProperty.call(parentData, directController)) {
    return directController;
  }
  
  if (meta) {
    for (const key in meta) {
      if (key.endsWith('_enum') && Array.isArray(meta[key])) {
        if (meta[key].includes(name)) {
          const controllerKey = key.replace('_enum', '');
          if (Object.prototype.hasOwnProperty.call(parentData, controllerKey)) {
            return controllerKey;
          }
        }
      }
    }
  }
  
  return null;
}

const sanitizeData = (currentData: any, originalData: any, key?: string, meta?: any): any => {
  if (currentData === null || currentData === undefined) {
    if (currentData === undefined) return undefined;
    return null;
  }
  
  if (typeof currentData === 'string') {
    if ((key && NUMERIC_KEYS.has(key)) || typeof originalData === 'number') {
      const parsed = Number(currentData);
      return isNaN(parsed) ? (originalData !== undefined ? originalData : 0) : parsed;
    }
    return currentData;
  }

  if (typeof currentData === 'number' && isNaN(currentData)) {
    return originalData !== undefined ? originalData : 0;
  }
  
  if (Array.isArray(currentData)) {
    return currentData.map((item, idx) => sanitizeData(item, originalData?.[idx], key, meta));
  }
  
  if (typeof currentData === 'object' && currentData !== null) {
    const result: any = {};
    for (const k in currentData) {
      // 防止原型污染與忽略繼承屬性
      if (!Object.prototype.hasOwnProperty.call(currentData, k)) continue;
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;

      // 多型剔除機制: 如果此鍵是由 enum 控制的多型屬性，檢查當前類型是否匹配
      const controllerKey = getPolymorphicController(k, currentData, meta);
      if (controllerKey && currentData[controllerKey] !== k) {
        continue; // 丟棄非 active 的多型資料 (ghost objects)
      }
      const sanitizedValue = sanitizeData(currentData[k], originalData?.[k], k, meta);
      if (sanitizedValue !== undefined) {
        result[k] = sanitizedValue;
      }
    }
    return result;
  }
  return currentData;
}

export default function DynamicForm({ filename, isItem, isMeta, data, meta, onSave, onDirtyChange }: DynamicFormProps) {
  const schema = isMeta ? baseMetaSchema : (filename ? getSchemaForForm(filename, !!isItem) : undefined);
  
  const { register, handleSubmit, control, reset, setValue, getValues, formState: { isDirty, errors } } = useForm({
    defaultValues: data,
    shouldUnregister: false,
    resolver: schema ? async (values, context, options) => {
      const activeValues = sanitizeData(values, data, undefined, meta);
      return zodResolver(schema as any)(activeValues, context, options);
    } : undefined,
  });

  const [isTextMode, setIsTextMode] = React.useState(false);
  const [textValue, setTextValue] = React.useState("");

  const prevDataRef = React.useRef(data);
  useEffect(() => {
    if (data !== prevDataRef.current) {
      if (isTextMode) {
        // 在純文字模式下，若發生外部更新 (例如存檔)，只更新 RHF 的基準值，不干擾目前表單內容
        reset(data, { keepValues: true });
      } else {
        // 一般表單模式下的正常重置
        reset(data);
      }
      prevDataRef.current = data;
    }
  }, [data, reset, isTextMode]);

  useEffect(() => {
    if (!isTextMode && onDirtyChange) {
      onDirtyChange(isDirty);
    }
  }, [isDirty, isTextMode, onDirtyChange]);

  const onValid = (formData: any) => {
    // If Zod passes, formData is already transformed (e.g. string to number). 
    // We still run sanitizeData to strip ghost polymorphic objects.
    const sanitized = sanitizeData(formData, data, undefined, meta);
    onSave(sanitized);
  };

  const onInvalid = () => {
    // Soft validation: prompt user if they want to force save
    if (window.confirm("表單存在驗證錯誤（標示紅字處），強制儲存可能會導致格式異常或資料遺失。確定要強制儲存嗎？")) {
      const rawData = getValues();
      const sanitized = sanitizeData(rawData, data, undefined, meta);
      onSave(sanitized);
    }
  };

  const handleSaveTextMode = () => {
    try {
      const parsed = JSON.parse(textValue);
      if (schema) {
        const result = schema.safeParse(parsed);
        if (!result.success) {
          if (!window.confirm("JSON 格式符合，但有內容驗證錯誤。確定要強制儲存嗎？")) {
             return;
          }
        }
      }
      onSave(parsed);
    } catch (e) {
      toast.error("JSON 格式錯誤，無法儲存");
    }
  };

  const toggleTextMode = () => {
    if (!isTextMode) {
      const currentData = getValues();
      const sanitized = sanitizeData(currentData, data, undefined, meta);
      setTextValue(JSON.stringify(sanitized, null, 2));
      setIsTextMode(true);
    } else {
      try {
        const parsed = JSON.parse(textValue);
        reset(parsed, { keepDefaultValues: true });
        setIsTextMode(false);
      } catch (e) {
        toast.error("JSON 格式錯誤，無法切換回表單模式");
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button type="button" onClick={toggleTextMode} className="bg-secondary text-secondary-foreground hover:bg-secondary/80 shadow-sm border">
          {isTextMode ? "切換為表單模式" : "切換為純文字模式"}
        </Button>
      </div>
      {isTextMode ? (
        <div className="space-y-4">
          <textarea
            className="w-full h-[60vh] font-mono text-base md:text-sm p-4 border rounded-md bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={textValue}
            onChange={(e) => {
              setTextValue(e.target.value);
              if (onDirtyChange) onDirtyChange(true);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Tab') {
                e.preventDefault();
                const start = e.currentTarget.selectionStart;
                const end = e.currentTarget.selectionEnd;
                setTextValue(textValue.substring(0, start) + "  " + textValue.substring(end));
                setTimeout(() => {
                  if (e.currentTarget) {
                    e.currentTarget.selectionStart = e.currentTarget.selectionEnd = start + 2;
                  }
                }, 0);
              }
            }}
          />
          <div className="sticky bottom-4 z-10">
            <Button type="button" className="w-full shadow-lg" onClick={handleSaveTextMode}>
              儲存文字修改
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onValid, onInvalid)} className="space-y-6">
          <div className="space-y-4">
            {Object.keys(data).map((key) => (
              <RecursiveField
                key={key}
                name={key}
                value={data[key]}
                meta={meta}
                register={register}
                control={control}
                setValue={setValue}
                path={key}
                parentData={data}
                errors={errors}
              />
            ))}
          </div>
          <div className="sticky bottom-4 z-10">
            <Button type="submit" className="w-full shadow-lg">
              儲存修改
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

function PolymorphicObjectWrapper(props: RecursiveFieldProps & { controllerKey: string }) {
  const { name, controllerKey, control, path, parentData } = props;
  const lastDot = path.lastIndexOf('.');
  const controllerPath = lastDot >= 0 ? `${path.slice(0, lastDot)}.${controllerKey}` : controllerKey;
  const currentTypeValue = useWatch({ control, name: controllerPath, defaultValue: parentData[controllerKey] });
  
  if (currentTypeValue !== name) return null;
  return <ObjectField {...props} />;
}

interface RecursiveFieldProps {
  name: string;
  value: any;
  meta: any;
  register: UseFormRegister<any>;
  control: Control<any>;
  setValue: UseFormSetValue<any>;
  path: string;
  parentData: any;
  errors?: FieldErrors<any>;
}

function getFieldError(errors: FieldErrors<any> | undefined, path: string) {
  if (!errors) return undefined;
  const parts = path.split('.');
  let current: any = errors;
  for (const part of parts) {
    if (current && current[part]) {
      current = current[part];
    } else {
      return undefined;
    }
  }
  return current?.message as string | undefined;
}

function RecursiveField(props: RecursiveFieldProps) {
  const { name, value, meta, register, path, parentData, errors } = props;
  
  if (name === '_meta' || name === 'id') return null;

  const controllerKey = getPolymorphicController(name, parentData, meta);
  if (controllerKey) {
    return <PolymorphicObjectWrapper {...props} controllerKey={controllerKey} />;
  }

  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return <ObjectField {...props} />;
  }

  if (Array.isArray(value)) {
    return <ArrayField {...props} />;
  }

  const errorMessage = getFieldError(errors, path);

  const enumValues = meta?.[`${name}_enum`];
  if (enumValues && Array.isArray(enumValues)) {
    return (
      <div className="flex flex-col gap-1">
        <Label className={errorMessage ? "text-destructive" : ""}>{name}</Label>
        <select
          {...register(path)}
          className={`flex h-10 w-full rounded-md border bg-background px-3 py-2 text-base md:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${errorMessage ? 'border-destructive focus-visible:ring-destructive' : 'border-input'}`}
        >
          {enumValues.map((opt) => (
            <option key={String(opt)} value={opt || ""}>
              {opt === null ? 'null' : opt}
            </option>
          ))}
        </select>
        {errorMessage && <span className="text-xs text-destructive font-medium">{errorMessage}</span>}
        {meta[`${name}_note`] && !errorMessage && <span className="text-xs text-muted-foreground">{meta[`${name}_note`]}</span>}
      </div>
    );
  }

  if (typeof value === 'boolean') {
    return (
      <div className="flex flex-col gap-1">
        <label htmlFor={path} className="flex items-center gap-3 cursor-pointer min-h-[44px] p-2 -ml-2 rounded-md hover:bg-muted/50">
          <input type="checkbox" {...register(path)} id={path} className="h-4 w-4 accent-primary" />
          <span className={errorMessage ? "text-destructive text-sm font-medium" : "text-sm font-medium"}>{name}</span>
        </label>
        {errorMessage && <span className="text-xs text-destructive font-medium">{errorMessage}</span>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <Label className={errorMessage ? "text-destructive" : ""}>{name}</Label>
      <Input
        type="text"
        className={errorMessage ? 'border-destructive focus-visible:ring-destructive' : ''}
        {...register(path)}
      />
      {errorMessage && <span className="text-xs text-destructive font-medium">{errorMessage}</span>}
      {meta?.[`${name}_note`] && !errorMessage && <span className="text-xs text-muted-foreground">{meta[`${name}_note`]}</span>}
    </div>
  );
}

function ObjectField(props: RecursiveFieldProps) {
  const { name, value, meta, path, register } = props;
  // value might be undefined if it's a new array item
  const safeValue = value || {};
  const keys = Object.keys(safeValue);
  
  const hasDeltas = ['exp_delta', 'aca_delta', 'hp_delta'].some(k => keys.includes(k));
  const normalKeys = hasDeltas ? keys.filter(k => k !== 'exp_delta' && k !== 'aca_delta' && k !== 'hp_delta') : keys;

  return (
    <div className="p-4 border rounded-md space-y-4 bg-muted/20">
      {isNaN(Number(name)) && <h4 className="font-semibold text-lg capitalize">{name}</h4>}
      {meta?.[`${name}_note`] && <p className="text-xs text-muted-foreground">{meta[`${name}_note`]}</p>}
      
      {normalKeys.map((subKey) => (
        <RecursiveField
          {...props}
          key={subKey}
          name={subKey}
          value={safeValue[subKey]}
          path={`${path}.${subKey}`}
          parentData={safeValue}
        />
      ))}

      {hasDeltas && (
        <div className="mt-4 border rounded-md overflow-hidden bg-background">
          <table className="w-full text-sm text-center border-collapse">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th className="p-2 border-b border-r font-medium">exp_delta</th>
                <th className="p-2 border-b border-r font-medium">aca_delta</th>
                <th className="p-2 border-b font-medium">hp_delta</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="p-2 border-r">
                  <Input type="number" className="h-8 text-center" {...register(`${path}.exp_delta`, { valueAsNumber: true })} />
                </td>
                <td className="p-2 border-r">
                  <Input type="number" className="h-8 text-center" {...register(`${path}.aca_delta`, { valueAsNumber: true })} />
                </td>
                <td className="p-2">
                  <Input type="number" className="h-8 text-center" {...register(`${path}.hp_delta`, { valueAsNumber: true })} />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function generateEmptyTemplate(obj: any): any {
  if (Array.isArray(obj)) return [];
  if (obj !== null && typeof obj === 'object') {
    const res: any = {};
    for (const key in obj) {
      // 防止原型污染與忽略繼承屬性
      if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;

      if (key === 'id') {
        res[key] = null;
      } else {
        res[key] = generateEmptyTemplate(obj[key]);
      }
    }
    return res;
  }
  if (typeof obj === 'string') return '';
  if (typeof obj === 'number') return 0;
  if (typeof obj === 'boolean') return false;
  return null;
}

function ArrayField(props: RecursiveFieldProps) {
  const activeFile = useEditorStore(state => state.activeFile);
  const filename = activeFile?.name;
  const { name, value, control, path, setValue } = props;
  
  // For arrays of primitives, we fall back to a controlled map because useFieldArray only supports objects
  const isPrimitiveArray = PRIMITIVE_ARRAY_KEYS.has(name) || (value.length > 0 && typeof value[0] !== 'object');

  if (isPrimitiveArray) {
    const currentArray = useWatch({ control, name: path, defaultValue: value }) || [];
    return (
      <div className="p-4 border rounded-md space-y-4">
        <h4 className="font-semibold capitalize flex items-center justify-between">
          {name}
          <span className="text-sm text-muted-foreground flex items-center">共 {currentArray.length} 項</span>
        </h4>
        {currentArray.map((item: any, index: number) => (
          <div key={index} className="flex gap-2 items-center">
            <Input 
              value={item} 
              onChange={(e) => {
                const newArr = [...currentArray];
                newArr[index] = e.target.value;
                setValue(path, newArr, { shouldDirty: true });
              }} 
            />
            <div className="flex items-center gap-1 shrink-0">
              <Button
                 type="button"
                 className="h-10 w-10 md:h-8 md:w-8 p-0 text-muted-foreground bg-transparent hover:bg-muted"
                 onClick={() => { 
                   if (index > 0) {
                     const newArr = [...currentArray];
                     [newArr[index - 1], newArr[index]] = [newArr[index], newArr[index - 1]];
                     setValue(path, newArr, { shouldDirty: true });
                   }
                 }}
                 disabled={index === 0}
              >
                <ArrowUp className="h-4 w-4" />
              </Button>
              <Button
                 type="button"
                 className="h-10 w-10 md:h-8 md:w-8 p-0 text-muted-foreground bg-transparent hover:bg-muted"
                 onClick={() => { 
                   if (index < currentArray.length - 1) {
                     const newArr = [...currentArray];
                     [newArr[index], newArr[index + 1]] = [newArr[index + 1], newArr[index]];
                     setValue(path, newArr, { shouldDirty: true });
                   }
                 }}
                 disabled={index === currentArray.length - 1}
              >
                <ArrowDown className="h-4 w-4" />
              </Button>
              <Button type="button" className="h-10 px-3 text-sm md:h-6 md:px-2 md:text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90 ml-1" onClick={() => {
                 const newArr = [...currentArray];
                 newArr.splice(index, 1);
                 setValue(path, newArr, { shouldDirty: true });
              }}>移除</Button>
            </div>
          </div>
        ))}
        <Button 
          type="button" 
          className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-input h-10 shadow-sm"
          onClick={() => {
             setValue(path, [...currentArray, ""], { shouldDirty: true });
          }}>
          + 新增項目
        </Button>
      </div>
    );
  }

  // Object Array with useFieldArray
  const { fields, append, remove, move, replace } = useFieldArray({
    control,
    name: path
  });

  const isEventSequence = name === 'sequence';
  const currentArrayData = useWatch({ control, name: path }) || [];

  const syntheticItems = React.useMemo(() => {
    if (!isEventSequence) return fields.map((f, i) => ({ id: f.id, type: 'item', realIndex: i }));
    
    const items: any[] = [];
    let currentYear: number | undefined = undefined;
    let currentSem: number | undefined = undefined;
    
    fields.forEach((field: any, index) => {
      const data = currentArrayData[index] || {};
      const y = data.year ?? currentYear;
      const s = data.semester ?? currentSem;
      
      if (y !== currentYear || s !== currentSem) {
        if (y !== undefined && s !== undefined) {
          items.push({
            id: `boundary-${y}-${s}-${index}`,
            type: 'boundary',
            year: y,
            semester: s,
            isBoundary: true,
          });
          currentYear = y;
          currentSem = s;
        }
      }
      items.push({
        id: field.id,
        type: 'item',
        realIndex: index,
      });
    });
    return items;
  }, [fields, currentArrayData, isEventSequence]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = syntheticItems.findIndex((i) => i.id === active.id);
    const newIndex = syntheticItems.findIndex((i) => i.id === over.id);
    
    if (oldIndex === -1 || newIndex === -1) return;

    const newSynthetic = arrayMove(syntheticItems, oldIndex, newIndex);
    
    if (!isEventSequence) {
      const fromReal = syntheticItems[oldIndex].realIndex;
      const toReal = syntheticItems[newIndex].realIndex;
      if (fromReal !== undefined && toReal !== undefined) {
        move(fromReal, toReal);
      }
      return;
    }

    let curYear: number | undefined = undefined;
    let curSem: number | undefined = undefined;
    
    const newFields: any[] = [];
    
    newSynthetic.forEach(item => {
      if (item.type === 'boundary') {
        curYear = item.year;
        curSem = item.semester;
      } else {
        const realIdx = item.realIndex!;
        const originalField = fields[realIdx] as any;
        const currentData = currentArrayData[realIdx];
        
        let targetYear = curYear;
        let targetSem = curSem;
        
        if (targetYear === undefined || targetSem === undefined) {
           targetYear = currentData.year ?? originalField.year;
           targetSem = currentData.semester ?? originalField.semester;
           curYear = targetYear;
           curSem = targetSem;
        }
        
        const { id, ...restOriginal } = originalField;

        newFields.push({
          ...restOriginal,
          ...currentData,
          year: targetYear,
          semester: targetSem,
        });
      }
    });

    newFields.forEach((f, idx) => {
      if (f.index !== undefined) {
        f.index = idx;
      }
    });

    replace(newFields);
  };

  return (
    <div className="p-4 border rounded-md space-y-4">
      <h4 className="font-semibold capitalize flex items-center justify-between">
        {name}
        <span className="text-sm text-muted-foreground flex items-center">共 {fields.length} 項</span>
      </h4>
      <div className="space-y-2">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={syntheticItems.map(i => i.id)} strategy={verticalListSortingStrategy}>
            {syntheticItems.map((item) => (
              <SortableArrayItem key={item.id} id={item.id} isBoundary={item.isBoundary}>
                {item.type === 'boundary' ? (
                  <div className="py-2 px-4 bg-primary/10 text-primary border-l-4 border-primary rounded-r-md font-bold text-sm my-2">
                    📍 {item.year} 學年度 第 {item.semester} 學期
                  </div>
                ) : (
                  <CollapsibleArrayItem
                    index={item.realIndex!}
                    field={fields[item.realIndex!]}
                    value={value}
                    path={path}
                    remove={remove}
                    move={move}
                    totalLength={fields.length}
                    props={props}
                    control={control}
                    hideArrows={isEventSequence}
                  />
                )}
              </SortableArrayItem>
            ))}
          </SortableContext>
        </DndContext>
      </div>
      <Button 
        type="button" 
        className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-input h-10 shadow-sm"
        onClick={() => {
          let newItem;
          const defaultItem = getDefaultItemForArray(filename, name);
          if (defaultItem) {
            newItem = JSON.parse(JSON.stringify(defaultItem));
          } else {
            const template = value[0] || {};
            newItem = generateEmptyTemplate(template);
          }
          append(newItem);
        }}
      >
        + 新增項目
      </Button>
    </div>
  );
}

function CollapsibleArrayItem({ index, field, value, path, remove, move, totalLength, props, control, hideArrows }: any) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [label, rank, status, question, display_name, event_name, event_id] = useWatch({ 
    control, 
    name: [
      `${path}.${index}.label`, 
      `${path}.${index}.rank`, 
      `${path}.${index}.status`, 
      `${path}.${index}.question`,
      `${path}.${index}.display_name`,
      `${path}.${index}.event_name`,
      `${path}.${index}.event_id`
    ] 
  });
  
  // Header Preview Logic
  let previewTitle = `Item ${index + 1}`;
  if (display_name || event_name) {
    previewTitle = display_name || event_name;
  } else if (label !== undefined && label !== null && label !== "") {
    previewTitle = `選項: ${label}`;
  } else if (rank !== undefined && rank !== null && rank !== "") {
    previewTitle = `名次: ${rank}`;
  } else if (question !== undefined && question !== null && question !== "") {
    previewTitle = question;
    if (status) {
      previewTitle = `[${status}] ${previewTitle}`;
    }
  }

  return (
    <div className="border rounded-md bg-card shadow-sm transition-all">
       <div 
         className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 transition-colors"
         onClick={() => setIsOpen(!isOpen)}
       >
         <div className="flex flex-col flex-1 pr-2 overflow-hidden">
           <h5 className="font-medium text-sm text-card-foreground truncate">{previewTitle}</h5>
           {event_id && <span className="text-xs text-muted-foreground font-mono mt-0.5 truncate">{event_id}</span>}
         </div>
         <div className="flex items-center gap-1 shrink-0">
            {!hideArrows && (
              <>
                <Button
                   type="button"
                   className="h-10 w-10 md:h-8 md:w-8 p-0 text-muted-foreground bg-transparent hover:bg-muted"
                   onClick={(e) => { e.stopPropagation(); if (index > 0) move(index, index - 1); }}
                   disabled={index === 0}
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button
                   type="button"
                   className="h-10 w-10 md:h-8 md:w-8 p-0 text-muted-foreground bg-transparent hover:bg-muted"
                   onClick={(e) => { e.stopPropagation(); if (index < totalLength - 1) move(index, index + 1); }}
                   disabled={index === totalLength - 1}
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
              </>
            )}
            <Button 
              type="button" 
              className="h-10 px-3 text-sm md:h-6 md:px-2 md:text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90 ml-2"
              onClick={(e) => { e.stopPropagation(); remove(index); }}
            >
              移除
            </Button>
            {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground ml-2" /> : <ChevronDown className="h-4 w-4 text-muted-foreground ml-2" />}
         </div>
       </div>
       <div className={`p-4 border-t bg-muted/10 ${isOpen ? 'block' : 'hidden'}`}>
          <ObjectField
            {...props}
            name={`${index}`}
            value={field}
            path={`${path}.${index}`}
            parentData={value}
          />
       </div>
    </div>
  );
}
