export default abstract class BaseTranslator {
    abstract translate(text: string, from: string, to: string): Promise<string>;

    protected validateParams(text: string, from: string, to: string): void {
        if (!text) throw new Error("Text to translate cannot be empty.");
        if (!from || !to) throw new Error("Source and target languages must be specified.");
    }
}