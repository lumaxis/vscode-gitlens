'use strict';
import { Range, TextDocumentShowOptions, TextEditor, Uri } from 'vscode';
import { FileAnnotationType } from '../configuration';
import { Container } from '../container';
import { GitUri } from '../git/gitService';
import { Logger } from '../logger';
import { Messages } from '../messages';
import { ActiveEditorCommand, command, Commands, findOrOpenEditor, getCommandUri } from './common';

export interface OpenRevisionFileCommandArgs {
	uri?: Uri;
	line?: number;
	showOptions?: TextDocumentShowOptions;
	annotationType?: FileAnnotationType;
}

@command()
export class OpenRevisionFileCommand extends ActiveEditorCommand {
	constructor() {
		super(Commands.OpenRevisionFile);
	}

	async execute(editor: TextEditor, uri?: Uri, args?: OpenRevisionFileCommandArgs) {
		args = { ...args };
		if (args.line === undefined) {
			args.line = editor == null ? 0 : editor.selection.active.line;
		}

		try {
			if (args.uri == null) {
				uri = getCommandUri(uri, editor);
				if (uri == null) return undefined;
			} else {
				uri = args.uri;
			}

			args.uri = await GitUri.fromUri(uri);
			if (GitUri.is(args.uri) && args.uri.sha) {
				const commit = await Container.git.getCommit(args.uri.repoPath!, args.uri.sha);

				args.uri =
					commit !== undefined && commit.status === 'D'
						? GitUri.toRevisionUri(commit.previousSha!, commit.previousUri.fsPath, commit.repoPath)
						: GitUri.toRevisionUri(args.uri);
			}

			if (args.line !== undefined && args.line !== 0) {
				if (args.showOptions === undefined) {
					args.showOptions = {};
				}
				args.showOptions.selection = new Range(args.line, 0, args.line, 0);
			}

			const e = await findOrOpenEditor(args.uri, { ...args.showOptions, rethrow: true });
			if (args.annotationType === undefined) return e;

			return Container.fileAnnotations.show(e, args.annotationType, args.line);
		} catch (ex) {
			Logger.error(ex, 'OpenRevisionFileCommand');
			return Messages.showGenericErrorMessage('Unable to open file revision');
		}
	}
}
