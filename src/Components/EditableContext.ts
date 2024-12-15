import React from "react";
import {FormInstance} from "antd/es/form/hooks/useForm";

export const EditableContext = React.createContext<FormInstance | null>(null);