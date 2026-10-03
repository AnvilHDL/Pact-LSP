#!/bin/sh
# Stand-in compiler for testing how the language server handles misbehaving
# compilers. The first argument (passed via the `extraArgs` compiler option)
# selects the behaviour.

for arg in "$@"; do
  if [ "$arg" = "-help" ]; then
    echo "  -json Output compilation results in JSON format"
    echo "  -just-check Only typecheck and validate the input files"
    exit 0
  fi
done

case "$1" in
  crash)
    echo "Fatal error: exception Not_found" >&2
    exit 2
    ;;
  hang)
    exec sleep 10
    ;;
  echo-args)
    printf '{"success":true,"errors":[],"output":"%s"}\n' "$*"
    ;;
esac
