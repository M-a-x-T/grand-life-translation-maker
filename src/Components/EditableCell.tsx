import {ReactNode, useContext, useEffect, useRef, useState} from "react";
import {Form, InputRef} from "antd";
import {EditableContext} from "./EditableContext.ts";
import DataSourceItem from "../Interfaces/DataSourceItem.ts";
import TextArea from "antd/es/input/TextArea";

export default function EditableCell({title, editable, children, dataIndex, record, handleSave, ...restProps}: {
    title: string,
    editable: boolean,
    children: ReactNode,
    dataIndex: number,
    record: DataSourceItem[],
    // eslint-disable-next-line @typescript-eslint/ban-types
    handleSave: Function
}) {
    const [editing, setEditing] = useState(false);
    const inputRef = useRef<InputRef>(null);
    const form = useContext(EditableContext);

    useEffect(() => {
        if (editing) {
            inputRef.current?.focus();
        }
    }, [editing]);

    const toggleEdit = () => {
        setEditing(!editing);
        if (form === null) {
            return
        }
        form.setFieldsValue({[dataIndex]: record[dataIndex]});
    };

    const save = async () => {
        try {
            if (form === null) {
                return
            }
            const values = await form.validateFields();
            toggleEdit();
            handleSave({...record, ...values});
        } catch (errInfo) {
            console.error("Save failed:", errInfo);
        }
    };

    let childNode = children;

    if (editable) {
        childNode = editing ? (
            <Form.Item
                style={{margin: 0}}
                name={dataIndex}
                rules={[{
                    required: true,
                    message: `${title} is required.`,
                }]}
            >
                <TextArea rows={8} ref={inputRef} onPressEnter={save} onBlur={save}/>
            </Form.Item>
        ) : (
            <div className="editable-cell-value-wrap" onClick={toggleEdit}>
                {children}
            </div>
        );
    }

    return <td {...restProps}>{childNode}</td>;
}