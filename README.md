# swap-pizdec

Чтобы установить БУН
```
https://bun.sh/docs/installation
```

Чтобы установить все необходимые ЗАВИСИМОСТИ:

```bash
bun install
```

Чтобы запустить:

```bash
bun run src/index.ts
```

### Настройка
В папке лежит файлик `config.toml`, в котором нужно изменить значения вот по этой табличке:

##### Config

| Поле          | Обязательность | Тип         | Описание                                                   | Пример                                |
|---------------|----------------|-------------|------------------------------------------------------------|---------------------------------------|
| accounts_path | Обязательно    | Строка      | Путь до файла с аккаунтами                                 | "accounts.txt"                        |
| rpc_url       | Обязательно    | Строка      | Ссылка до рпс ноды                                         | "https://api.mainnet-beta.solana.com" |
| fee_payer     | Необязательно  | Строка      | Приватный ключ аккаунта, который будет за газюльку платить | "ThRd....."                           |
| inputs_mints  | Обязательно    | InputMint[] | Массив с адресами токенов, за которые покупать             |                                       |
| output_mints  | Обязательно    | OutputMint[ | Массив адресов токенов, которых нужно купить               |                                       |



##### InputMint

| Поле         | Обязательность | Тип              | Описание                  | Пример         |
|--------------|----------------|------------------|---------------------------|----------------|
| amount_range | Обязательно    | [number, number] | Диапазон значений покупки | [0.002, 0.003] |


##### OutputMint

| Поле             | Обязательность | Тип      | Описание                                                 | Пример           |
|------------------|----------------|----------|----------------------------------------------------------|------------------|
| sell_percentages | Обязательно    | number[] | Проценты для свопа от общего количества токенов на счету | [25, 25, 25, 25] |

Для полноты картины, в репозитории есть пример конфига

ну кароче все! <3