import {Form} from "antd";
import {EditableContext} from "./EditableContext.ts";

export default function EditableRow({...props}) {
    const [form] = Form.useForm();
    return (
        <Form form={form} component={false}>
            <EditableContext.Provider value={form}>
                <tr {...props} />
            </EditableContext.Provider>
        </Form>
    );
}