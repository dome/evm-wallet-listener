#!/bin/bash
set -e
exec > >(tee -i ./setup.log)
exec 2>&1

CHAIN=ETH
ENV=development
NETWORK=testnet

main(){
    welcome
    selectEnvironment
    selectBlockchainParams
    configRabbitMq
    configDatabase
    configBackend
    configS3
    configMail
    generateEnvironmentFile
    installDocker
    startDocker
}

welcome(){
        echo "
        ##################################################
       ##                                              ##
      ##    Setting up EVM based Block Listener       ##
     ##                                              ##
    ##################################################
    "
}

selectEnvironment(){
    read -p $'\e[1;92mEnter project name :\e[0m ' PROJECT

    echo -e "\n####### Selecting Environment ######"

    env_options=("development" "staging" "production")
    echo $'\e[1;92mSelect Environment:\033[0m'
    select env in "${env_options[@]}"; do
        if [[ "${env_options[*]}" =~ "$env" ]]; then
        ENV="$env"
        break
        else
        echo "Invalid option. Please select a valid number."
        fi
    done
}

selectChain(){
    options=("ETH" "BNB" "MATIC" "FTM" "Quit")
    echo -e ""
    echo $'\e[1;92mSelect Blockchain:\033[0m'
    # Display the menu and prompt for selection
    select choice in "${options[@]}"; do
    case $choice in
        "ETH")
        CHAIN="ETH"
        RABBIT_PORT1=5672
        RABBIT_PORT2=15672
        break
        ;;
        "BNB")
        CHAIN="BNB"
        RABBIT_PORT1=5673
        RABBIT_PORT2=15673
        break
        ;;
        "MATIC")
        CHAIN="MATIC"
        RABBIT_PORT1=5674
        RABBIT_PORT2=15674
        break
        ;;
        "FTM")
        CHAIN="FTM"
        RABBIT_PORT1=5675
        RABBIT_PORT2=15675
        break
        ;;
        "Quit")
        echo "Exiting..."
        break
        ;;
        *)
        echo "Invalid option. Please select a valid number."
        ;;

    esac
    done
}

createNewDirectory(){
    # Get the current directory path
    current_dir=$(pwd)

    # Extract the parent directory path
    parent_dir=$(dirname "$current_dir")
    new_dir_name="evm-common-wallet-listener"

    if [[ "$ENV" != "development" ]]; then
        new_dir_name="ICO-$CHAIN-Wallet-Listener"

        # Create the new directory if it doesn't exist
        if [ ! -d "$parent_dir/$new_dir_name" ]; then
           sudo mkdir "$parent_dir/$new_dir_name"
           sudo chmod +x "$parent_dir/$new_dir_name"
        fi
        echo "New directory created with name '$new_dir_name'"

        echo "Copying files..."

        # Move the contents of the current directory to the new directory
        sudo cp -r "$current_dir"/* "$parent_dir/$new_dir_name"

        echo "Moving into '$parent_dir/$new_dir_name'"
        cd "$parent_dir/$new_dir_name"
    fi

}

selectNetwork(){
    network_options=("mainnet" "testnet")
    echo -e ""
    echo $'\e[1;92mSelect Network:\033[0m'
    select network in "${network_options[@]}"; do
        if [[ "${network_options[*]}" =~ "$network" ]]; then
        NETWORK="$network"
        break
        else
        echo "Invalid option. Please select a valid number."
        fi
    done
}

selectTokens(){
    CUSTODIAN_WALLET=()
    # Prompt to check if tokens need to be added
    read -p $'\e[1;92mDo you need to add tokens like USDT, USDC .etc (y/n)\033[0m: ' add_tokens

    # Check the user's response
    if [[ $add_tokens =~ ^[Yy]$ ]]; then
        token_options=("USDT" "USDC")
        TOKENS=()

        echo $'\e[1;92mAdd Tokens :\033[0m'

        # Display the options with numbers
        for i in "${!token_options[@]}"; do
        echo "$((i+1)). ${token_options[i]}"
        done

        while true; do
        # Prompt for network selections
        read -rp "Enter the numbers of the tokens (separated by spaces): " selections

        # Process the selections
        invalid_option=false
        for num in $selections; do
            index=$((num - 1))
            if ((index >= 0 && index < ${#token_options[@]})); then
            TOKENS+=("\"${token_options[index]}\"")
            else
            echo "Invalid option: $num"
            invalid_option=true
            break
            fi
        done

        if ! "$invalid_option"; then
            # Break out of the loop if selections are valid
            break
        fi

        # Clear the selected networks and prompt again
        TOKENS=()
        done
    echo -e ""
    read -p $'\e[1;92mEnter Custodian Wallet address:\033[0m' CUSTODIAN_WALLET
    fi

}

selectBlockchainParams(){
    echo -e "\n####### Configuring Blockchain Parameters ######"

    selectChain
    createNewDirectory
    selectNetwork

    echo -e ""
    read -p $'\e[1;92mEnter WSS provider url for '"$CHAIN $NETWORK"$':\e[0m ' WSS_PROVIDER_URL
    read -p $'\e[1;92mEnter HTTP provider url for '"$CHAIN $NETWORK"$':\e[0m ' HTTP_PROVIDER_URL
    read -p $'\e[1;92mEnter Admin Wallet address:\033[0m' ADMIN_WALLET

    echo -e ""
    selectTokens

    echo -e ""
    BLOCK_CONFIRMATIONS=6
    BATCH_SIZE=20
    RETRIES=3
}

configRabbitMq(){
    echo -e "\n####### Configuring RabbitMQ ######"
    read -p $'\e[1;92mEnter rabbitmq username:\033[0m' username
    read -p $'\e[1;92mEnter rabbitmq password:\033[0m' password

    [[ ! -z "$username" ]] && RABBIT_USER=${username:-rabbituser}
    [[ ! -z "$password" ]] && RABBIT_PASS=${password:-rabbitpass}


    {
        echo "listeners.tcp.default = $RABBIT_PORT1"
        echo "management.tcp.port = $RABBIT_PORT2"
        echo "default_user = $RABBIT_USER"
        echo "default_pass = $RABBIT_PASS"
    } | sed 's/^[ \t]*//' > ./rabbitmq.conf

    RMQ_CONN_URL="amqp://$RABBIT_USER:$RABBIT_PASS@rabbitmq:$RABBIT_PORT1"
    RMQ_TXNS_QUEUE=txns_queue
    RMQ_TRANSFER_QUEUE=transfer_queue
    RMQ_UPDATE_QUEUE=update_queue
    echo "Created rabbitmq.conf..."
}

configDatabase(){
    echo -e "\n####### Configuring Database (MongoDB) ######"

    if [[ "$ENV" != "development" ]]; then
        read -p $'\e[1;92mEnter tokensale mongo & queue server IP:\033[0m' MON_IP
        read -p $'\e[1;92mEnter tokensale mongo username:\033[0m' MON_USER
        read -p $'\e[1;92mEnter tokensale mongo password:\033[0m' MON_PASS
        DB_URI="mongodb://$MON_USER:$MON_PASS@$MON_IP:27017/tokensale"
    else
        DB_URI='mongodb://mongo:27017/tokensale'
    fi


    read -p $'\e[1;92mDo you need to override current block status? (y/n)\033[0m: ' block_override

    # Check the user's response
    if [[ $block_override =~ ^[Yy]$ ]]; then
        CURRENT_BLOCK_OVERRIDE=true
        read -p $'\e[1;92mEnter Block Number:\033[0m' CURRENT_BLOCK
    else
        CURRENT_BLOCK_OVERRIDE=false
        CURRENT_BLOCK=0
    fi
}

configBackend(){
    echo -e "\n####### Configuring Backend ######"

    read -p $'\e[1;92mEnter the application URL:\033[0m' BACKEND_URI
    read -p $'\e[1;92mEnter the application secert key:\033[0m' BACKEND_AUTH_TOKEN
}

configS3(){
    if [[ "$ENV" != "development" ]]; then
        echo -e "\n####### Configuring AWS S3 for Logs ######"

        read -p $'\e[1;92mEnter the AWS S3 Bucket Name:\033[0m' S3_BUCKET
        read -p $'\e[1;92mEnter the AWS S3 Access Key Id:\033[0m' AWS_ACCESS_KEY_ID
        read -p $'\e[1;92mEnter the AWS S3 Secret Access Key:\033[0m' AWS_SECRET_ACCESS_KEY
        read -p $'\e[1;92mEnter the AWS S3 Region:\033[0m' S3_REGION
        API_VERSION=2014-11-01
        S3_FOLDER="Wallet-Listener-$CHAIN-$ENV-logs"
    fi
}

configMail(){
    if [[ "$ENV" != "development" ]]; then
        echo -e "\n####### Configuring SMTP Server for Notification ######"

        MAIL_INTERVAL=1
        read -p $'\e[1;92mEnter the SMTP Host IP:\033[0m' SMTP_HOST
        read -p $'\e[1;92mEnter the SMTP Port:\033[0m' SMTP_PORT
        read -p $'\e[1;92mEnter the SMTP Username:\033[0m' SMTP_USERNAME
        read -p $'\e[1;92mEnter the SMTP Password:\033[0m' SMTP_PASSWORD
        read -p $'\e[1;92mEnter the SMTP Sender mail Id:\033[0m' SMTP_SENDER
        echo -e ""
        # Prompt the user to input email IDs
        read -p $'\e[1;92mEnter a list of email IDs (separated by spaces):\033[0m ' -a email_ids

        # Format email IDs with double quotes and commas
        formatted_emails=$(printf '"%s",' "${email_ids[@]}")
        formatted_emails=${formatted_emails%,} # Remove trailing comma

        # Assign the formatted email IDs to the SMTP_RECEIVERS variable
        MAIL_RECEIVERS="[$formatted_emails]"

        # Display the assigned email IDs
        echo "MAIL_RECEIVERS: $MAIL_RECEIVERS"
    fi
}

generateEnvironmentFile(){
    echo -e "\n####### Generating environment file ######"
    {
        echo "
            PROJECT_NAME=$PROJECT
            NODE_ENV=$ENV

            #BLOCKCHAIN
            CHAIN=$CHAIN
            NETWORK=$NETWORK
            WSS_PROVIDER_URL=$WSS_PROVIDER_URL
            HTTP_PROVIDER_URL=$HTTP_PROVIDER_URL
            ADMIN_WALLET=$ADMIN_WALLET
            ERC20_TOKENS="[$(IFS=,; echo "${TOKENS[*]}")]"
            CUSTODIAN_WALLET=$CUSTODIAN_WALLET
            BLOCK_CONFIRMATIONS=$BLOCK_CONFIRMATIONS
            BATCH_SIZE=$BATCH_SIZE
            RETRIES=$RETRIES

            #QUEUE
            RMQ_CONN_URL=$RMQ_CONN_URL
            RMQ_TXNS_QUEUE=$RMQ_TXNS_QUEUE
            RMQ_TRANSFER_QUEUE=$RMQ_TRANSFER_QUEUE
            RMQ_UPDATE_QUEUE=$RMQ_UPDATE_QUEUE

            #DB
            DB_URI=$DB_URI
            CURRENT_BLOCK_OVERRIDE=$CURRENT_BLOCK_OVERRIDE
            CURRENT_BLOCK=$CURRENT_BLOCK

            #BACKEND
            BACKEND_URI=$BACKEND_URI
            BACKEND_AUTH_TOKEN=$BACKEND_AUTH_TOKEN

            #AWS S3
            S3_BUCKET=$S3_BUCKET
            AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID
            AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY
            API_VERSION= $API_VERSION
            S3_REGION=$S3_REGION
            S3_FOLDER=$S3_FOLDER

            #MAIL
            MAIL_INTERVAL=$MAIL_INTERVAL
            MAIL_RECEIVERS=${MAIL_RECEIVERS:-[]}

            #SMTP
            SMTP_HOST=$SMTP_HOST
            SMTP_PORT=$SMTP_PORT
            SMTP_USERNAME=$SMTP_USERNAME
            SMTP_PASSWORD=$SMTP_PASSWORD
            SMTP_SENDER=$SMTP_SENDER

            #Active Campaign
            AC_URI=
            AC_API_KEY=
            AC_ID=

            #DOCKER
            NAME_SUFFIX="$(echo "$CHAIN" | tr '[:upper:]' '[:lower:]')"
        "
    } | sed 's/^[ \t]*//' >  ./.env

    echo "Created .env file."

}

installDocker(){
    echo -e  "\n####### Installing Docker ######"
    cd ~
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh

    # sudo groupadd docker
    sudo usermod -aG docker $USER
    sudo docker ps

    echo -e "\n####### Installing Docker compose ######"
    sudo curl -L "https://github.com/docker/compose/releases/download/1.29.2/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    docker-compose --version
}

startDocker(){
    cd "$parent_dir/$new_dir_name"
    echo -e "\n####### Starting Services ######"

    if [[ "$ENV" == "development" ]]; then
        sudo docker-compose up -d --build
    else
        sudo docker-compose -f docker-compose.prod.yml up -d --build
    fi

    echo -e "\n####### Successfully Started all the services! ######"
    echo -e "\n####### Setup Completed ######"
}

main