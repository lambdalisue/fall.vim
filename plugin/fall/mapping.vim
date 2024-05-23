if exists('g:loaded_fall_mapping')
  finish
endif
let g:loaded_fall_mapping = 1

function! s:map_source_picker() abort
  " Cursor
  cnoremap <nowait><buffer> <C-p> <Plug>(fall-cursor-prev)
  cnoremap <nowait><buffer> <C-n> <Plug>(fall-cursor-next)
  cnoremap <nowait><buffer> <C-u> <Plug>(fall-cursor-prev-scroll)
  cnoremap <nowait><buffer> <C-d> <Plug>(fall-cursor-next-scroll)
  cnoremap <nowait><buffer> <C-t> <Plug>(fall-cursor-first)
  cnoremap <nowait><buffer> <C-g> <Plug>(fall-cursor-last)
  " Select
  cnoremap <nowait><buffer> <C-,> <Plug>(fall-select)
  cnoremap <nowait><buffer> <C-.> <Plug>(fall-select-all)
  cnoremap <nowait><buffer> <C-j> <Plug>(fall-select)<Plug>(fall-cursor-next)
  cnoremap <nowait><buffer> <C-k> <Plug>(fall-cursor-prev)<Plug>(fall-select)
  " Action
  cnoremap <nowait><buffer> <Tab> <Plug>(fall-action-select)
  cnoremap <nowait><buffer> <Return> <Plug>(fall-action-default)
  " Preview
  cnoremap <nowait><buffer> <Up> <Plug>(fall-preview-prev)
  cnoremap <nowait><buffer> <Down> <Plug>(fall-preview-next)
  cnoremap <nowait><buffer> <PageUp> <Plug>(fall-preview-prev-scroll)
  cnoremap <nowait><buffer> <PageDown> <Plug>(fall-preview-next-scroll)
  cnoremap <nowait><buffer> <Home> <Plug>(fall-preview-first)
  cnoremap <nowait><buffer> <End> <Plug>(fall-preview-last)
endfunction

function! s:unmap_source_picker() abort
  " Cursor
  silent cunmap <buffer> <C-p>
  silent cunmap <buffer> <C-n>
  silent cunmap <buffer> <C-u>
  silent cunmap <buffer> <C-d>
  silent cunmap <buffer> <C-t>
  silent cunmap <buffer> <C-g>
  " Select
  silent cunmap <buffer> <C-,>
  silent cunmap <buffer> <C-.>
  silent cunmap <buffer> <C-j>
  silent cunmap <buffer> <C-k>
  " Action
  silent cunmap <buffer> <Tab>
  silent cunmap <buffer> <Return>
  " Preview
  silent cunmap <buffer> <Up>
  silent cunmap <buffer> <Down>
  silent cunmap <buffer> <Home>
  silent cunmap <buffer> <End>
  silent cunmap <buffer> <PageUp>
  silent cunmap <buffer> <PageDown>
endfunction

function! s:map_action_picker() abort
  " Cursor
  cnoremap <nowait><buffer> <C-p> <Plug>(fall-cursor-prev)
  cnoremap <nowait><buffer> <C-n> <Plug>(fall-cursor-next)
  cnoremap <nowait><buffer> <C-u> <Plug>(fall-cursor-prev-scroll)
  cnoremap <nowait><buffer> <C-d> <Plug>(fall-cursor-next-scroll)
  cnoremap <nowait><buffer> <C-t> <Plug>(fall-cursor-first)
  cnoremap <nowait><buffer> <C-g> <Plug>(fall-cursor-last)
  " Preview
  cnoremap <nowait><buffer> <Up> <Plug>(fall-preview-prev)
  cnoremap <nowait><buffer> <Down> <Plug>(fall-preview-next)
  cnoremap <nowait><buffer> <PageUp> <Plug>(fall-preview-prev-scroll)
  cnoremap <nowait><buffer> <PageDown> <Plug>(fall-preview-next-scroll)
  cnoremap <nowait><buffer> <Home> <Plug>(fall-preview-first)
  cnoremap <nowait><buffer> <End> <Plug>(fall-preview-last)
endfunction

function! s:unmap_action_picker() abort
  " Cursor
  silent cunmap <buffer> <C-p>
  silent cunmap <buffer> <C-n>
  silent cunmap <buffer> <C-u>
  silent cunmap <buffer> <C-d>
  silent cunmap <buffer> <C-t>
  silent cunmap <buffer> <C-g>
  " Preview
  silent cunmap <buffer> <Up>
  silent cunmap <buffer> <Down>
  silent cunmap <buffer> <Home>
  silent cunmap <buffer> <End>
  silent cunmap <buffer> <PageUp>
  silent cunmap <buffer> <PageDown>
endfunction

" Cursor
cnoremap <silent> <Plug>(fall-cursor-first) <Cmd>call <SID>dispatch('select-cursor-move-at', 1)<CR>
cnoremap <silent> <Plug>(fall-cursor-last) <Cmd>call <SID>dispatch('select-cursor-move-at', '$')<CR>
cnoremap <silent> <Plug>(fall-cursor-next) <Cmd>call <SID>dispatch('select-cursor-move', 1)<CR>
cnoremap <silent> <Plug>(fall-cursor-prev) <Cmd>call <SID>dispatch('select-cursor-move', -1)<CR>
cnoremap <silent> <Plug>(fall-cursor-next-scroll) <Cmd>call <SID>dispatch('select-cursor-move', <SID>select_scroll())<CR>
cnoremap <silent> <Plug>(fall-cursor-prev-scroll) <Cmd>call <SID>dispatch('select-cursor-move', -1 * <SID>select_scroll())<CR>
" Select
cnoremap <silent> <Plug>(fall-select) <Cmd>call <SID>dispatch('select-select')<CR>
cnoremap <silent> <Plug>(fall-select-all) <Cmd>call <SID>dispatch('select-select-all')<CR>
" Action
cnoremap <silent> <Plug>(fall-action-select) <Cmd>call <SID>dispatch('action-invoke', '@select')<CR>
cnoremap <silent> <Plug>(fall-action-default) <Cmd>call <SID>dispatch('action-invoke', '@default')<CR>
" Preview
cnoremap <silent> <Plug>(fall-preview-first) <Cmd>call <SID>dispatch('preview-cursor-move-at', 1)<CR>
cnoremap <silent> <Plug>(fall-preview-last) <Cmd>call <SID>dispatch('preview-cursor-move-at', '$')<CR>
cnoremap <silent> <Plug>(fall-preview-next) <Cmd>call <SID>dispatch('preview-cursor-move', 1)<CR>
cnoremap <silent> <Plug>(fall-preview-prev) <Cmd>call <SID>dispatch('preview-cursor-move', -1)<CR>
cnoremap <silent> <Plug>(fall-preview-next-scroll) <Cmd>call <SID>dispatch('preview-cursor-move', <SID>preview_scroll())<CR>
cnoremap <silent> <Plug>(fall-preview-prev-scroll) <Cmd>call <SID>dispatch('preview-cursor-move', -1 * <SID>preview_scroll())<CR>

function! s:dispatch(name, ...) abort
  const l:args = a:0 ? [a:name, a:1] : [a:name]
  call denops#notify('fall', 'event:dispatch', l:args)
endfunction

function! s:select_scroll() abort
  let l:winid = get(g:, '_fall_layout_select_winid')
  if !l:winid
    return &scroll
  endif
  return getwinvar(l:winid, '&l:scroll', &scroll)
endfunction

function! s:preview_scroll() abort
  let l:winid = get(g:, '_fall_layout_preview_winid')
  if !l:winid
    return &scroll
  endif
  return getwinvar(l:winid, '&l:scroll', &scroll)
endfunction

if !get(g:, 'fall_disable_default_mapping')
  augroup fall_mapping_plugin
    autocmd!
    autocmd User FallPickerEnter:source:* call s:map_source_picker()
    autocmd User FallPickerLeave:source:* call s:unmap_source_picker()
    autocmd User FallPickerEnter:action call s:map_action_picker()
    autocmd User FallPickerLeave:action call s:unmap_action_picker()
  augroup END
endif
