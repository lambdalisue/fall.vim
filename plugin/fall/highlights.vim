if exists('g:loaded_fall_highlights')
  finish
endif
let g:loaded_fall_highlights = 1

if has('nvim')
  highlight default link FallNormal FloatNormal
  highlight default link FallBorder FloatBorder
else
  highlight default link FallNormal Normal
  highlight default link FallBorder EndOfBuffer
endif

" Prompt
highlight default link FallPromptHeader FallBorder
highlight default link FallPromptCursor Cursor

" Selector
highlight default link FallSelectorCursor CursorLine
highlight default link FallSelectorSelected CurSearch
sign define FallSelectorCursor linehl=FallSelectorCursor texthl=FallSelectorCursor
sign define FallSelectorSelected text=* linehl=FallSelectorSelected texthl=FallSelectorSelected

" Picker
highlight default link FallPickerMatch Search
