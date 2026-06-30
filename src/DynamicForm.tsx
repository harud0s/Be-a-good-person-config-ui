import React, { useEffect } from 'react';
import { useForm, useWatch, useFieldArray } from 'react-hook-form';
import type { Control, UseFormRegister, UseFormSetValue, FieldErrors } from 'react-hook-form';
import { ChevronDown, ChevronUp, ArrowUp, ArrowDown } from 'lucide-react';
import { zodResolver } from '@hookform/resolvers/zod';
import { getSchemaForForm, NUMERIC_KEYS, PRIMITIVE_ARRAY_KEYS } from './schemas';

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input className={["flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50", className].filter(Boolean).join(" ")} ref={ref} {...props} />
));

const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(({ className, ...props }, ref) => (
  <button className={["inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2", className].filter(Boolean).join(" ")} ref={ref} {...props} />
));

const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(({ className, ...props }, ref) => (
  <label className={["text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70", className].filter(Boolean).join(" ")} ref={ref} {...props} />
));

interface DynamicFormProps {
  filename?: string;
  isItem?: boolean;
  data: any;
  meta: any;
  onSave: (data: any) => void;
  onDirtyChange?: (isDirty: boolean) => void;
}

// 判斷是否為多型欄位
function getPolymorphicController(name: string, parentData: any, meta: any) {
  if (!parentData || !meta) return null;
  const parentTypeKeys = Object.keys(parentData).filter(k => k.endsWith('_type'));
  for (const typeKey of parentTypeKeys) {
    const enumKey = `${typeKey}_enum`;
    if (meta[enumKey] && Array.isArray(meta[enumKey]) && meta[enumKey].includes(name)) {
      return typeKey;
    }
  }
  return null;
}

const sanitizeData = (currentData: any, originalData: any, key?: string, meta?: any): any => {
  if (currentData === null || currentData === undefined) return null;
  if (currentData === '') return null;
  
  if (typeof currentData === 'string') {
    if ((key && NUMERIC_KEYS.has(key)) || typeof originalData === 'number') {
      const parsed = Number(currentData);
      return isNaN(parsed) ? currentData : parsed;
    }
  }
  
  if (Array.isArray(currentData)) {
    return currentData.map((item, idx) => sanitizeData(item, originalData?.[idx], key, meta));
  }
  
  if (typeof currentData === 'object' && currentData !== null) {
    const result: any = {};
    for (const k in currentData) {
      // 多型剔除機制: 如果此鍵是由 enum 控制的多型屬性，檢查當前類型是否匹配
      const controllerKey = getPolymorphicController(k, currentData, meta);
      if (controllerKey && currentData[controllerKey] !== k) {
        continue; // 丟棄非 active 的多型資料 (ghost objects)
      }
      result[k] = sanitizeData(currentData[k], originalData?.[k], k, meta);
    }
    return result;
  }
  return currentData;
}

export default function DynamicForm({ filename, isItem, data, meta, onSave, onDirtyChange }: DynamicFormProps) {
  const schema = filename ? getSchemaForForm(filename, !!isItem) : undefined;
  
  const { register, handleSubmit, control, reset, setValue, getValues, formState: { isDirty, errors } } = useForm({
    defaultValues: data,
    shouldUnregister: true, // Prevents zombie data in form state
    resolver: schema ? zodResolver(schema as any) : undefined,
  });

  useEffect(() => {
    reset(data);
  }, [data, reset]);

  useEffect(() => {
    if (onDirtyChange) onDirtyChange(isDirty);
  }, [isDirty, onDirtyChange]);

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

  return (
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
  );
}

function PolymorphicObjectWrapper(props: RecursiveFieldProps & { controllerKey: string }) {
  const { name, controllerKey, control, path, parentData } = props;
  const controllerPath = path.replace(new RegExp(`${name}$`), controllerKey);
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
          className={`flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${errorMessage ? 'border-destructive focus-visible:ring-destructive' : 'border-input'}`}
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
        <div className="flex items-center gap-2">
          <input type="checkbox" {...register(path)} id={path} className="h-4 w-4 accent-primary" />
          <Label htmlFor={path} className={errorMessage ? "text-destructive" : ""}>{name}</Label>
        </div>
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
  const { name, value, meta, path } = props;
  // value might be undefined if it's a new array item
  const safeValue = value || {};
  return (
    <div className="p-4 border rounded-md space-y-4 bg-muted/20">
      <h4 className="font-semibold text-lg capitalize">{name}</h4>
      {meta?.[`${name}_note`] && <p className="text-xs text-muted-foreground">{meta[`${name}_note`]}</p>}
      {Object.keys(safeValue).map((subKey) => (
        <RecursiveField
          {...props}
          key={subKey}
          name={subKey}
          value={safeValue[subKey]}
          path={`${path}.${subKey}`}
          parentData={safeValue}
        />
      ))}
    </div>
  );
}

function ArrayField(props: RecursiveFieldProps) {
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
                 className="h-10 w-10 p-0 text-muted-foreground bg-transparent hover:bg-muted"
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
                 className="h-10 w-10 p-0 text-muted-foreground bg-transparent hover:bg-muted"
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
              <Button type="button" className="h-10 px-4 bg-destructive text-destructive-foreground hover:bg-destructive/90 ml-1" onClick={() => {
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
  const { fields, append, remove, move } = useFieldArray({
    control,
    name: path
  });

  return (
    <div className="p-4 border rounded-md space-y-4">
      <h4 className="font-semibold capitalize flex items-center justify-between">
        {name}
        <span className="text-sm text-muted-foreground flex items-center">共 {fields.length} 項</span>
      </h4>
      <div className="space-y-2">
        {fields.map((field, index) => (
          <CollapsibleArrayItem
            key={field.id}
            index={index}
            field={field}
            value={value}
            path={path}
            remove={remove}
            move={move}
            totalLength={fields.length}
            props={props}
            control={control}
          />
        ))}
      </div>
      <Button 
        type="button" 
        className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-input h-10 shadow-sm"
        onClick={() => {
          const template = value[0] || {};
          const newItem = Object.keys(template).reduce((acc, k) => ({ ...acc, [k]: null }), {});
          append(newItem);
        }}
      >
        + 新增項目
      </Button>
    </div>
  );
}

function CollapsibleArrayItem({ index, field, value, path, remove, move, totalLength, props, control }: any) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [label, rank] = useWatch({ 
    control, 
    name: [`${path}.${index}.label`, `${path}.${index}.rank`] 
  });
  
  // Header Preview Logic
  let previewTitle = `Item ${index + 1}`;
  if (label !== undefined && label !== null && label !== "") {
    previewTitle = `選項: ${label}`;
  } else if (rank !== undefined && rank !== null && rank !== "") {
    previewTitle = `名次: ${rank}`;
  }

  return (
    <div className="border rounded-md bg-card shadow-sm transition-all">
       <div 
         className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 transition-colors"
         onClick={() => setIsOpen(!isOpen)}
       >
         <h5 className="font-medium text-sm text-card-foreground">{previewTitle}</h5>
         <div className="flex items-center gap-1">
            <Button
               type="button"
               className="h-8 w-8 p-0 text-muted-foreground bg-transparent hover:bg-muted"
               onClick={(e) => { e.stopPropagation(); if (index > 0) move(index, index - 1); }}
               disabled={index === 0}
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
            <Button
               type="button"
               className="h-8 w-8 p-0 text-muted-foreground bg-transparent hover:bg-muted"
               onClick={(e) => { e.stopPropagation(); if (index < totalLength - 1) move(index, index + 1); }}
               disabled={index === totalLength - 1}
            >
              <ArrowDown className="h-4 w-4" />
            </Button>
            <Button 
              type="button" 
              className="h-6 px-2 text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90 ml-2"
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
