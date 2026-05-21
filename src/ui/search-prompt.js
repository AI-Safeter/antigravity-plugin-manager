const chalk = require('chalk');
const readline = require('readline');
const Fuse = require('fuse.js');
const fs = require('fs');
const path = require('path');
const { select } = require('@inquirer/prompts');
const { runWithEscape, CLACK_THEME } = require('../utils/installer');

const V2_CYAN = chalk.hex('#22D3EE');
const V2_VIOLET = chalk.hex('#8B5CF6');
const ANSI_REGEX = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;

function sanitizeTerminalInput(text) {
  if (typeof text !== 'string') return text;
  // Strip control characters and dangerous escape sequences (ASCII 0-31, 127, and 128-159)
  // while preserving newlines (\n \x0A and \r \x0D) for Markdown/detail formatting.
  return text.replace(/[\x00-\x09\x0B-\x0C\x0E-\x1F\x7F-\x9F]/g, '');
}

function getCleanRepo(repoUrl) {
  if (!repoUrl) return 'antigravity-official';
  const match = repoUrl.match(/github\.com\/([^/]+\/[^/]+)/);
  return match ? match[1] : 'antigravity-official';
}

function getVisualRowCount(text, termWidth) {
  const lines = text.split('\n');
  const width = (termWidth && termWidth > 0) ? termWidth : 80;
  let rows = 0;
  for (const line of lines) {
    const cleanLine = line.replace(ANSI_REGEX, '');
    const length = cleanLine.length;
    rows += Math.max(1, Math.ceil(length / width));
  }
  return rows;
}

function interactiveSearchCheckbox(registry, installed) {
  return new Promise((resolve, reject) => {
    const selectedIds = new Set();
    let searchQuery = '';
    let cursorIndex = 0;
    const pageSize = 5; // 5 items * 3 lines/item = 15 lines viewport

    let results = registry;

    // Optimize Fuse.js: Instantiate ONLY once outside the keystroke updates
    const fuse = new Fuse(registry, {
      keys: ['name', 'description', 'id'],
      threshold: 0.4
    });

    const wasRaw = process.stdin.isRaw;
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    process.stdin.resume();
    readline.emitKeypressEvents(process.stdin);

    // Hide terminal cursor to keep rendering clean
    process.stdout.write('\x1b[?25l');

    // Clear the screen initially to anchor search prompt neatly at top
    console.clear();

    let lastRenderedLineCount = 0;

    let isCleanedUp = false;

    // Resilient raw terminal state crash handler using exit hook instead of hijacking uncaughtException
    const onPanic = () => {
      if (isCleanedUp) return;
      process.stdout.write('\x1b[?25h'); // Restore cursor
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(wasRaw);
      }
    };

    process.once('exit', onPanic);

    function updateResults() {
      if (searchQuery.trim() === '') {
        results = registry;
      } else {
        // Reuse pre-constructed Fuse instance
        results = fuse.search(searchQuery).map(r => r.item);
      }
      
      // Clamp cursorIndex to new results boundary
      if (cursorIndex >= results.length) {
        cursorIndex = Math.max(0, results.length - 1);
      }
    }

    async function showPluginDetail(p, isSelected, isInstalled) {
      // Clear search prompt from console
      if (lastRenderedLineCount > 0) {
        readline.cursorTo(process.stdout, 0);
        readline.moveCursor(process.stdout, 0, -lastRenderedLineCount);
        readline.clearScreenDown(process.stdout);
        lastRenderedLineCount = 0;
      }

      // Restore cursor for select prompts
      process.stdout.write('\x1b[?25h');
      console.clear();

      const termWidth = process.stdout.columns || 80;
      const boxWidth = Math.min(80, termWidth - 4);
      const border = '━'.repeat(boxWidth);

      const safeName = sanitizeTerminalInput(p.name);
      const safeId = sanitizeTerminalInput(p.id);
      const safeRepo = sanitizeTerminalInput(p.repository || 'antigravity-official');

      console.log(`\n${V2_VIOLET(border)}`);
      console.log(` ${V2_CYAN.bold('PLUGIN DETAILED VIEW')}`);
      console.log(`${V2_VIOLET(border)}`);
      console.log(` ${chalk.bold('Name:')}        ${safeName}`);
      console.log(` ${chalk.bold('ID:')}          ${safeId}`);

      console.log(` ${chalk.bold('Status:')}      ${isInstalled ? chalk.green('Installed') : (isSelected ? V2_CYAN('Selected for install') : chalk.gray('Not selected'))}`);
      console.log(`${V2_VIOLET(border)}`);
      console.log(` ${chalk.bold('Description:')}`);

      let detailContent = sanitizeTerminalInput(p.description || '');
      let isMarkdown = false;
      try {
        const skillFilePath = path.join(__dirname, '../../plugins', p.id, 'SKILL.md');
        if (fs.existsSync(skillFilePath)) {
          const rawContent = fs.readFileSync(skillFilePath, 'utf8');
          const match = rawContent.match(/^---[\s\S]*?---([\s\S]*)$/);
          if (match && match[1].trim()) {
            detailContent = sanitizeTerminalInput(match[1].trim());
            isMarkdown = true;
          }
        }
      } catch (err) {
        // Fallback to description
      }

      if (isMarkdown) {
        const lines = detailContent.split('\n');
        let inCodeBlock = false;
        lines.forEach(lineStr => {
          let trimmed = lineStr.trim();
          if (trimmed.startsWith('```')) {
            inCodeBlock = !inCodeBlock;
            return; // skip backticks line
          }

          let formattedLine = lineStr;
          if (inCodeBlock) {
            formattedLine = '    ' + chalk.hex('#A5F3FC')(lineStr); // Cyan for code blocks
          } else {
            if (trimmed.startsWith('#')) {
              const depth = (trimmed.match(/^#+/) || ['#'])[0].length;
              const text = trimmed.replace(/^#+\s*/, '');
              formattedLine = '\n  ' + V2_CYAN.bold('█ '.repeat(Math.min(3, depth)) + text);
            } else if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
              formattedLine = '  ' + chalk.hex('#8B5CF6')('•') + ' ' + lineStr.replace(/^[-*]\s*/, '');
            } else {
              formattedLine = '  ' + lineStr;
            }
          }

          // Wrap line nicely
          const wrapWidth = boxWidth - 4;
          const words = formattedLine.split(' ');
          let wrappedLine = '';
          words.forEach(w => {
            if ((wrappedLine + w).replace(ANSI_REGEX, '').length > wrapWidth) {
              console.log(wrappedLine);
              wrappedLine = (inCodeBlock ? '    ' : '  ') + w + ' ';
            } else {
              wrappedLine += w + ' ';
            }
          });
          if (wrappedLine.trim()) console.log(wrappedLine);
        });
      } else {
        const paragraphs = detailContent.split('\n');
        paragraphs.forEach(paragraph => {
          const words = paragraph.split(' ');
          let line = '  ';
          words.forEach(w => {
            if ((line + w).length > boxWidth - 4) {
              console.log(chalk.gray(line));
              line = '  ' + w + ' ';
            } else {
              line += w + ' ';
            }
          });
          if (line.trim()) console.log(chalk.gray(line));
        });
      }
      console.log(`${V2_VIOLET(border)}\n`);

      let action;
      try {
        const choices = [];
        if (!isInstalled) {
          choices.push({
            name: isSelected ? '○ Deselect this plugin' : '● Select this plugin for installation',
            value: 'toggle'
          });
          choices.push({
            name: '📥 Install this plugin immediately',
            value: 'install_single'
          });
        }
        choices.push({
          name: `📥 Install all ${selectedIds.size} selected plugins`,
          value: 'install_selected'
        });
        choices.push({
          name: '⬅️ Go back to search',
          value: 'back'
        });

        action = await runWithEscape(select, {
          message: 'Select action:',
          choices,
          theme: CLACK_THEME
        });
      } catch (err) {
        action = 'back';
      }

      // Restore raw mode & hide cursor
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
      }
      process.stdin.resume();
      process.stdout.write('\x1b[?25l');

      return action;
    }

    function render() {
      const lines = [];
      
      const termWidth = process.stdout.columns || 80;
      const boxWidth = Math.min(100, termWidth - 4);
      const innerWidth = boxWidth - 6;

      // Status/Title header with violet diamond and bold white title
      lines.push(`  ${chalk.hex('#8B5CF6')('◆')}  ${chalk.white.bold('Discover plugins')} ${chalk.dim(`(${selectedIds.size}/${results.length})`)}`);
      
      // frame search input box styled in premium violet
      const borderTop = V2_VIOLET(`  ╭${'─'.repeat(boxWidth - 4)}╮`);
      const borderBottom = V2_VIOLET(`  ╰${'─'.repeat(boxWidth - 4)}╯`);

      let searchContent = searchQuery ? V2_CYAN(searchQuery) : chalk.gray('Search…');
      let contentPrefix = ` ⌕ `;
      let rawContentLength = (searchQuery ? searchQuery.length : 7) + 3;

      if (rawContentLength > innerWidth) {
        searchContent = searchQuery.substring(searchQuery.length - (innerWidth - 4));
        rawContentLength = innerWidth;
      }
      const padding = Math.max(0, innerWidth - rawContentLength);
      const lineContent = `  ${V2_VIOLET('│')}${contentPrefix}${searchContent}${' '.repeat(padding)}${V2_VIOLET('│')}`;

      lines.push(borderTop);
      lines.push(lineContent);
      lines.push(borderBottom);
      lines.push(''); // Spacing line as per mockup

      const count = results.length;
      if (count === 0) {
        lines.push(`     ${chalk.yellow('No matching plugins found.')}`);
        // Pad out standard spacing to avoid jumping height
        for (let i = 0; i < pageSize * 3; i++) {
          lines.push('');
        }
      } else {
        let startIndex = 0;
        if (count > pageSize) {
          startIndex = Math.max(0, cursorIndex - Math.floor(pageSize / 2));
          if (startIndex + pageSize > count) {
            startIndex = count - pageSize;
          }
        }
        const visibleResults = results.slice(startIndex, startIndex + pageSize);

        // More above indicator
        if (startIndex > 0) {
          lines.push(`   ${chalk.gray('↑ more above')}`);
        } else {
          lines.push('');
        }

        visibleResults.forEach((p, idx) => {
          const actualIdx = startIndex + idx;
          const isHovered = actualIdx === cursorIndex;
          const isInstalled = installed.includes(p.id);
          const isSelected = selectedIds.has(p.id);

          let prefix = chalk.gray('○');
          if (isInstalled) {
            prefix = chalk.green('✔');
          } else if (isSelected) {
            prefix = chalk.hex('#22D3EE')('●');
          } else {
            prefix = chalk.gray('○');
          }

          const safeName = sanitizeTerminalInput(p.name);
          const safeDesc = sanitizeTerminalInput(p.description || '');

          let nameStr = safeName;

          if (isHovered) {
            nameStr = chalk.bold.white(safeName);
            if (isSelected) {
              nameStr = chalk.bold.hex('#22D3EE')(safeName);
            }
          } else {
            if (isInstalled) {
              nameStr = chalk.gray(safeName);
            } else if (isSelected) {
              nameStr = V2_CYAN(safeName);
            } else {
              nameStr = chalk.white(safeName);
            }
          }

          const hoverMarker = isHovered ? V2_VIOLET('❯ ') : '  ';
          const firstLine = `  ${hoverMarker}${prefix} ${nameStr}`;
          
          const truncatedDesc = safeDesc.length > (boxWidth - 10) ? safeDesc.substring(0, boxWidth - 13) + '...' : safeDesc;
          const secondLine = `      ${chalk.gray(truncatedDesc)}`;

          lines.push(firstLine);
          lines.push(secondLine);
          lines.push(''); // Spacing line between elements
        });

        // Dynamic padding for paging stability
        const missingItems = pageSize - visibleResults.length;
        for (let i = 0; i < missingItems; i++) {
          lines.push('');
          lines.push('');
          lines.push('');
        }

        // More below indicator
        if (startIndex + pageSize < count) {
          lines.push(`   ${chalk.gray('↓ more below')}`);
        } else {
          lines.push('');
        }
      }

      // Footer styled in premium dimmed Clack shortcuts style
      lines.push('');
      const footerKeys = [
        ['Type', 'to search'],
        ['Space', 'to toggle'],
        ['Enter', 'to view'],
        ['Tab', 'to install selected'],
        ['Esc', 'to go back']
      ];
      const footerText = `  ` + chalk.dim(footerKeys.map(([k, a]) => `${chalk.bold(k)} ${a}`).join(' • '));
      lines.push(footerText);

      // Clear previous output and write new lines
      if (lastRenderedLineCount > 0) {
        readline.cursorTo(process.stdout, 0);
        readline.moveCursor(process.stdout, 0, -lastRenderedLineCount);
        readline.clearScreenDown(process.stdout);
      }

      const output = lines.join('\n');
      process.stdout.write(output);
      lastRenderedLineCount = getVisualRowCount(output, termWidth);
    }

    const cleanup = () => {
      if (isCleanedUp) return;
      isCleanedUp = true;
      process.removeListener('exit', onPanic);

      process.stdout.write('\x1b[?25h'); // Show terminal cursor
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(wasRaw);
      }
      process.stdin.removeListener('keypress', onKeypress);
      process.stdin.pause();
      
      // Clear printed lines from console
      if (lastRenderedLineCount > 0) {
        readline.cursorTo(process.stdout, 0);
        readline.moveCursor(process.stdout, 0, -lastRenderedLineCount);
        readline.clearScreenDown(process.stdout);
      }
    };

    const onKeypress = (str, key) => {
      if (key.ctrl && key.name === 'c') {
        cleanup();
        reject(new Error('force closed'));
        return;
      }

      if (key.name === 'escape') {
        cleanup();
        resolve(null);
        return;
      }

      if (key.name === 'tab') {
        cleanup();
        resolve(Array.from(selectedIds));
        return;
      }

      if (key.name === 'return' || key.name === 'enter') {
        if (results.length > 0) {
          const p = results[cursorIndex];
          if (p) {
            const isSelected = selectedIds.has(p.id);
            const isInstalled = installed.includes(p.id);

            process.stdin.removeListener('keypress', onKeypress);

            showPluginDetail(p, isSelected, isInstalled).then((action) => {
              if (action === 'toggle') {
                if (selectedIds.has(p.id)) {
                  selectedIds.delete(p.id);
                } else {
                  selectedIds.add(p.id);
                }
                process.stdin.on('keypress', onKeypress);
                console.clear();
                render();
              } else if (action === 'install_single') {
                cleanup();
                resolve([p.id]);
              } else if (action === 'install_selected') {
                cleanup();
                resolve(Array.from(selectedIds));
              } else {
                process.stdin.on('keypress', onKeypress);
                console.clear();
                render();
              }
            });
          }
        }
        return;
      }

      if (key.name === 'up') {
        if (results.length > 0) {
          cursorIndex = (cursorIndex - 1 + results.length) % results.length;
          render();
        }
        return;
      }

      if (key.name === 'down') {
        if (results.length > 0) {
          cursorIndex = (cursorIndex + 1) % results.length;
          render();
        }
        return;
      }

      if (key.name === 'space') {
        if (results.length > 0) {
          const p = results[cursorIndex];
          if (p && !installed.includes(p.id)) {
            if (selectedIds.has(p.id)) {
              selectedIds.delete(p.id);
            } else {
              selectedIds.add(p.id);
            }
            render();
          }
        }
        return;
      }


      if (key.name === 'backspace' || key.sequence === '\x08' || key.sequence === '\x7f') {
        if (searchQuery.length > 0) {
          searchQuery = searchQuery.slice(0, -1);
          updateResults();
          render();
        }
        return;
      }

      const isPrintable = /^[\x20-\x7E]$/.test(str);
      if (isPrintable && !key.ctrl && !key.meta) {
        searchQuery += str;
        updateResults();
        render();
      }
    };

    process.stdin.on('keypress', onKeypress);
    updateResults();
    render();
  });
}

module.exports = {
  interactiveSearchCheckbox
};
