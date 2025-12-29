import { StyleSheet } from "react-native";

export const detailScreenStyles = StyleSheet.create({
    centeredMessageContainer: {
        flex: 1,
        backgroundColor: "black",
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
    },
    errorText: {
        fontSize: 16,
        textAlign: "center",
    },
    emptyText: {
        fontSize: 16,
        textAlign: "center",
        marginTop: 20,
    },
    imageContainer: {
        alignItems: "center",
        paddingBottom: 20,
    },
    image: {
        width: 200,
        height: 200,
        marginBottom: 10,
    },
    placeholderImageContainer: {
        width: 200,
        height: 200,
        marginBottom: 10,
        backgroundColor: "#282828",
        justifyContent: "center",
        alignItems: "center",
    },
    listContentContainer: {
        paddingBottom: 0,
    },
});

export const tabScreenStyles = StyleSheet.create({
    list: {
        flex: 1,
        width: "100%",
    },
    listContentContainer: {
        paddingTop: 0,
        paddingBottom: 0,
    },
    centeredMessageContainer: {
        flex: 1,
        backgroundColor: "black",
        justifyContent: "center",
        alignItems: "center",
    },
    emptyText: {
        marginTop: 20,
        textAlign: "center",
    },
});
