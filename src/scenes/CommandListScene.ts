import Phaser from 'phaser';
import {
  applySystemCommand,
  COMMAND_CATALOG,
  parseRankingDeletionCommand,
  type CommandDefinition,
} from '../game/GameSettings';

type CommandListItem =
  | { kind: 'heading'; label: string }
  | { kind: 'command'; definition: CommandDefinition };

const LIST_TOP = 145;
const LIST_BOTTOM = 610;

export class CommandListScene extends Phaser.Scene {
  private searchText = '';
  private searchFocused = true;
  private activeValueCommand?: CommandDefinition;
  private readonly values = new Map<string, string>();
  private scrollOffset = 0;
  private status = '';
  private pageContent: Phaser.GameObjects.GameObject[] = [];
  private scrollbarDragging = false;

  constructor() {
    super('CommandListScene');
  }

  init(): void {
    this.searchText = '';
    this.searchFocused = true;
    this.activeValueCommand = undefined;
    this.values.clear();
    this.scrollOffset = 0;
    this.status = '';
    this.pageContent = [];
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#101722');
    const background = this.add.graphics();
    background.fillStyle(0x172333, 1);
    background.fillRect(0, 0, 1280, 720);
    background.fillStyle(0x1c2c3d, 0.96);
    background.fillRoundedRect(72, 28, 1136, 664, 16);
    background.lineStyle(2, 0x526b7b, 1);
    background.strokeRoundedRect(72, 28, 1136, 664, 16);
    background.fillStyle(0x58c4b8, 1);
    background.fillRect(72, 28, 1136, 6);

    this.add.text(640, 58, 'コマンド一覧', {
      fontFamily: 'sans-serif',
      fontSize: '34px',
      color: '#f5f1e8',
    }).setOrigin(0.5);
    this.add.text(180, 102, '検索', {
      fontFamily: 'sans-serif',
      fontSize: '18px',
      color: '#b7c9d8',
    }).setOrigin(1, 0.5);
    const searchBox = this.add.graphics();
    searchBox.fillStyle(0x101722, 1);
    searchBox.fillRoundedRect(200, 84, 880, 38, 6);
    searchBox.lineStyle(2, 0x58c4b8, 1);
    searchBox.strokeRoundedRect(200, 84, 880, 38, 6);
    this.add.zone(200, 84, 880, 38)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        this.searchFocused = true;
        this.activeValueCommand = undefined;
        this.renderRows();
      });
    this.add.text(640, 674, '値が必要なコマンドは入力後にクリック / ホイール・↑↓でスクロール / Escでタイトル', {
      fontFamily: 'sans-serif',
      fontSize: '15px',
      color: '#b7c9d8',
    }).setOrigin(0.5);

    this.input.keyboard?.on('keydown', this.handleKeyboard, this);
    this.input.keyboard?.on('keydown-UP', () => this.scrollRows(-1));
    this.input.keyboard?.on('keydown-DOWN', () => this.scrollRows(1));
    this.input.on(
      'wheel',
      (
        pointer: Phaser.Input.Pointer,
        _over: Phaser.GameObjects.GameObject[],
        _deltaX: number,
        deltaY: number,
      ) => {
        if (pointer.y >= LIST_TOP && pointer.y <= LIST_BOTTOM) {
          this.scrollRows(Math.sign(deltaY) * 3);
        }
      },
    );
    this.input.on('pointermove', this.dragScrollbar, this);
    this.input.on('pointerup', () => {
      this.scrollbarDragging = false;
    });
    this.renderRows();
  }

  private getListItems(): CommandListItem[] {
    const query = this.searchText.trim().toLowerCase();
    const commands = [...COMMAND_CATALOG]
      .filter(({ command, aliases }) => (
        command.toLowerCase().startsWith(query)
        || aliases.toLowerCase().startsWith(query)
      ))
      .sort((first, second) => first.command.localeCompare(second.command));
    const items: CommandListItem[] = [];
    let currentGroup = '';
    for (const definition of commands) {
      const group = definition.command.split(' ')[0];
      if (group !== currentGroup) {
        currentGroup = group;
        items.push({
          kind: 'heading',
          label: `${group[0].toUpperCase()}${group.slice(1)}`,
        });
      }
      items.push({ kind: 'command', definition });
    }
    return items;
  }

  private scrollRows(amount: number): void {
    const items = this.getListItems();
    this.scrollOffset = Phaser.Math.Clamp(
      this.scrollOffset + amount,
      0,
      Math.max(0, items.length - 10),
    );
    this.renderRows();
  }

  private renderRows(): void {
    for (const gameObject of this.pageContent) {
      gameObject.destroy();
    }
    this.pageContent = [];

    const items = this.getListItems();
    if (items.length === 0) {
      this.addPageText(
        '該当するコマンドはありません',
        640,
        LIST_TOP,
        '#b7c9d8',
        '22px',
      ).setOrigin(0.5, 0);
    } else {
      let y = LIST_TOP;
      for (let index = this.scrollOffset; index < items.length && y < LIST_BOTTOM; index += 1) {
        const item = items[index];
        if (item.kind === 'heading') {
          this.addPageText(item.label, 110, y, '#58c4b8', '23px');
          y += 34;
          continue;
        }

        this.renderCommand(item.definition, y);
        y += 48;
      }
    }

    const searchDisplay = this.searchText || (this.searchFocused ? '入力して検索...' : '');
    const searchDisplayText = this.addPageText(
      `${searchDisplay}${this.searchFocused ? '▏' : ''}`,
      218,
      92,
      this.searchText ? '#f5f1e8' : '#75899a',
      '18px',
    );
    searchDisplayText.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      this.searchFocused = true;
      this.activeValueCommand = undefined;
      this.renderRows();
    });
    this.addPageText(this.status, 640, 638, '#f5d58a', '16px').setOrigin(0.5, 0);
    this.renderScrollbar(items.length);
  }

  private renderCommand(definition: CommandDefinition, y: number): void {
    const commandLabel = definition.command.replace('{value}', '<value>');
    const aliases = definition.aliases.replace('{value}', '<value>');
    const commandText = this.addPageText(
      `${commandLabel}  (${aliases})`,
      128,
      y,
      '#f5f1e8',
      '17px',
    );
    commandText.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      this.searchFocused = false;
      const value = this.values.get(definition.command) ?? '';
      if (definition.inputLabel && value.trim() === '') {
        this.activeValueCommand = definition;
        this.status = '値を入力してください。空欄のままでは適用されません。';
        this.renderRows();
        return;
      }
      this.runCommand(definition);
    });
    const description = this.addPageText(
      definition.description,
      148,
      y + 23,
      '#b7c9d8',
      '14px',
    );
    if (definition.inputLabel) {
      const value = this.values.get(definition.command) ?? '';
      const isActive = this.activeValueCommand === definition;
      const inputBackground = this.add.graphics();
      inputBackground.fillStyle(0x101722, 1);
      inputBackground.fillRoundedRect(960, y, 190, 24, 4);
      inputBackground.lineStyle(1, isActive ? 0x58c4b8 : 0x526b7b, 1);
      inputBackground.strokeRoundedRect(960, y, 190, 24, 4);
      this.pageContent.push(inputBackground);
      const inputText = this.addPageText(
        value || definition.inputLabel,
        1055,
        y + 4,
        value ? '#f5d58a' : '#75899a',
        '14px',
      ).setOrigin(0.5, 0);
      inputText.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        this.searchFocused = false;
        this.activeValueCommand = definition;
        this.status = '値を入力してください。Enterまたはコマンドをクリックして適用します。';
        this.renderRows();
      });
      if (isActive) {
        inputText.setColor(value ? '#f5d58a' : '#58c4b8');
      }
      description.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        this.searchFocused = false;
        this.activeValueCommand = definition;
        this.renderRows();
      });
    }
  }

  private addPageText(
    text: string,
    x: number,
    y: number,
    color: string,
    fontSize: string,
  ): Phaser.GameObjects.Text {
    const item = this.add.text(x, y, text, {
      fontFamily: 'monospace',
      fontSize,
      color,
    });
    this.pageContent.push(item);
    return item;
  }

  private renderScrollbar(itemCount: number): void {
    if (itemCount === 0 || itemCount <= 10) {
      return;
    }
    const trackHeight = LIST_BOTTOM - LIST_TOP;
    const thumbHeight = Math.max(36, trackHeight * 10 / itemCount);
    const maxOffset = Math.max(1, itemCount - 1);
    const thumbTop = LIST_TOP
      + (trackHeight - thumbHeight) * this.scrollOffset / maxOffset;
    const graphics = this.add.graphics();
    graphics.fillStyle(0x26384a, 1);
    graphics.fillRoundedRect(1168, LIST_TOP, 8, trackHeight, 4);
    graphics.fillStyle(0x58c4b8, 1);
    graphics.fillRoundedRect(1168, thumbTop, 8, thumbHeight, 4);
    this.pageContent.push(graphics);
    const track = this.add.zone(1158, LIST_TOP, 28, trackHeight)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true });
    track.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.scrollbarDragging = true;
      this.scrollToScrollbarPointer(pointer.y, itemCount, thumbHeight, trackHeight);
    });
    this.pageContent.push(track);
  }

  private dragScrollbar(pointer: Phaser.Input.Pointer): void {
    if (!this.scrollbarDragging || !pointer.isDown) {
      return;
    }
    const itemCount = this.getListItems().length;
    const trackHeight = LIST_BOTTOM - LIST_TOP;
    const thumbHeight = Math.max(36, trackHeight * 10 / itemCount);
    this.scrollToScrollbarPointer(pointer.y, itemCount, thumbHeight, trackHeight);
  }

  private scrollToScrollbarPointer(
    pointerY: number,
    itemCount: number,
    thumbHeight: number,
    trackHeight: number,
  ): void {
    const maxOffset = Math.max(0, itemCount - 10);
    const travel = trackHeight - thumbHeight;
    const progress = travel > 0
      ? Phaser.Math.Clamp((pointerY - LIST_TOP - thumbHeight / 2) / travel, 0, 1)
      : 0;
    this.scrollOffset = Math.round(progress * maxOffset);
    this.renderRows();
  }

  private handleKeyboard(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.scene.start('TitleScene', { clearSeed: true });
      return;
    }
    if (event.key === 'Enter') {
      if (!this.searchFocused && this.activeValueCommand) {
        this.runCommand(this.activeValueCommand);
      }
      return;
    }
    if (this.searchFocused) {
      if (event.key === 'Backspace') {
        event.preventDefault();
        this.searchText = Array.from(this.searchText).slice(0, -1).join('');
        this.scrollOffset = 0;
        this.renderRows();
      } else if (
        event.key.length === 1
        && !event.ctrlKey
        && !event.metaKey
        && !event.altKey
      ) {
        this.searchText += event.key;
        this.scrollOffset = 0;
        this.renderRows();
      }
      return;
    }
    if (!this.activeValueCommand || event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }
    if (event.key === 'Backspace') {
      event.preventDefault();
      const value = this.values.get(this.activeValueCommand.command) ?? '';
      this.values.set(this.activeValueCommand.command, value.slice(0, -1));
      this.renderRows();
    } else if (/^[a-zA-Z0-9.-]$/.test(event.key)) {
      const value = this.values.get(this.activeValueCommand.command) ?? '';
      this.values.set(this.activeValueCommand.command, value + event.key);
      this.renderRows();
    }
  }

  private runCommand(definition: CommandDefinition): void {
    const value = this.values.get(definition.command) ?? '';
    if (definition.inputLabel && value.trim() === '') {
      this.status = '値を入力してください。空欄のままでは適用されません。';
      this.renderRows();
      return;
    }
    const command = definition.command.replace('{value}', value.trim());
    const result = applySystemCommand(command);
    if (result === 'show-developer-ranking') {
      this.scene.start('RankingScene', { developer: true });
    } else if (result === 'show-death-ranking') {
      this.scene.start('RankingScene', { death: true });
    } else if (result === 'show-ranking-delete-confirmation') {
      const request = parseRankingDeletionCommand(command);
      if (request) {
        this.scene.start('RankingDeleteScene', {
          ...request,
          returnScene: 'CommandListScene',
        });
      }
    } else if (result === 'show-command-list') {
      this.status = 'コマンド一覧を表示中です。';
      this.renderRows();
    } else if (result === 'applied') {
      this.status = '設定を適用しました。';
      this.values.delete(definition.command);
      this.activeValueCommand = undefined;
      this.searchFocused = false;
      this.renderRows();
    } else if (result === 'ignored') {
      this.status = '敵にエネルギーはありません。';
      this.renderRows();
    } else {
      this.status = 'コマンドまたは入力値を確認してください。';
      this.renderRows();
    }
  }
}
