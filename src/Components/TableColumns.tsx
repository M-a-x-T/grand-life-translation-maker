import {Button, Checkbox} from "antd";
import DataSourceItem from "../Interfaces/DataSourceItem.ts";

export default function TableColumns(
    handleCheckboxChange: (key: DataSourceItem, checked: boolean) => void,
    handleIgnoreChange: (key: DataSourceItem, checked: boolean) => void,
    handleTransOperation: (key: {
        category: string;
        isComplete: boolean;
        isIgnore: boolean;
        key: string;
        machineTranslate: string;
        originVersion: string;
        sourceFile: string;
        textPath?: string | undefined;
        translateVersion: string
    }) => void
) {
    return [
        {
            title: 'Key',
            dataIndex: 'key',
            key: 'key',
        },
        {
            title: 'Category',
            dataIndex: 'category',
            key: 'category',
        },
        {
            title: 'Origin Version',
            dataIndex: 'originVersion',
            key: 'originVersion',
        },
        {
            title: 'Translate Version',
            dataIndex: 'translateVersion',
            key: 'translateVersion',
            editable: true,
        },
        {
            title: 'Machine Translate',
            dataIndex: 'machineTranslate',
            key: 'machineTranslate',
        },
        {
            title: 'Is Complete',
            dataIndex: 'isComplete',
            key: 'isComplete',
            render: (isComplete: boolean, record: DataSourceItem) => (
                <Checkbox
                    checked={isComplete}
                    onChange={(e) => handleCheckboxChange(record, e.target.checked)}
                />
            ),
        },
        {
            title: 'Is Ignore',
            dataIndex: 'isIgnore',
            key: 'isIgnore',
            render: (isIgnore: boolean, record: DataSourceItem) => (
                <Checkbox
                    checked={isIgnore}
                    onChange={(e) => handleIgnoreChange(record, e.target.checked)}
                />
            ),
        },
        {
            title: 'Operation',
            dataIndex:
                'operation',
            render:
                (_value: undefined, record: DataSourceItem) =>
                        <div>
                            <Button
                                type="text"
                                onClick={() => handleTransOperation(record)
                                }
                                style={
                                    {
                                        marginRight: 8
                                    }
                                }
                            >
                                Trans
                            </Button>
                        </div>
        },
    ]
}