
export interface FormFields {
  headline: string;
  subheadline: string;
  price: string;
  discount: string;
  cta: string;
  currency: string;
}

export interface GenerationResult {
  id: string;
  src: string;
  ratio: string;
}

export type Template = 'Hero' | 'Price Tag' | 'UGC Style';
export type Ratio = '1:1' | '4:5' | '9:16' | '16:9';

export interface InlineData {
    mimeType: string;
    data: string;
}